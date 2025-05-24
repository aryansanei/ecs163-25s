const width = window.innerWidth;
const height = window.innerHeight;

// Set up dimensions and margins for the bar chart
let barLeft = 0, barTop = 0;
let barMargin = {top: 60, right: 30, bottom: 80, left: 100},
    barWidth = d3.select('.overview').node().getBoundingClientRect().width - barMargin.left - barMargin.right,
    barHeight = 400 - barMargin.top - barMargin.bottom;

// Set up dimensions and margins for the line chart
let lineLeft = 0, lineTop = 0;
let lineMargin = {top: 60, right: 30, bottom: 80, left: 100},
    lineWidth = d3.select('.trends').node().getBoundingClientRect().width - lineMargin.left - lineMargin.right,
    lineHeight = 400 - lineMargin.top - lineMargin.bottom;

// Set up dimensions and margins for the Sankey diagram
let sankeyLeft = 0, sankeyTop = 0;
let sankeyMargin = {top: 20, right: 20, bottom: 20, left: 20},
    sankeyWidth = d3.select('.sankey').node().getBoundingClientRect().width - sankeyMargin.left - sankeyMargin.right,
    sankeyHeight = d3.select('.sankey').node().getBoundingClientRect().height - sankeyMargin.top - sankeyMargin.bottom;

// Define a mapping for the experience level labels to make them more human-readable
const expLevelMap = {
    "EN": "Entry Level",
    "MI": "Mid Level",
    "SE": "Senior",
    "EX": "Executive"
};

// Set up a consistent color scheme for experience levels across all visualizations
const expLevelColors = {
    "EN": "#4e79a7",
    "MI": "#f28e2c",
    "SE": "#59a14f",
    "EX": "#e15759"
};

// Create the tooltip that will be used across all visualizations
const tooltip = d3.select(".tooltip");

// Global state management for interactions
let globalState = {
    selectedExperienceLevels: new Set(["EN", "MI", "SE", "EX"]), // All selected by default
    selectedTimeRange: [2020, 2023], // Full time range by default
    data: null,
    isAnimating: false
};

// Animation duration constants
const ANIMATION_DURATION = 800;
const STAGGER_DELAY = 100;

// Load and parse the CSV data
d3.csv("ds_salaries.csv").then(rawData => {
    // Convert string values to numbers where needed
    rawData.forEach(d => {
        d.work_year = +d.work_year;
        d.salary = +d.salary;
        d.salary_in_usd = +d.salary_in_usd;
        d.remote_ratio = +d.remote_ratio;
    });

    // Store data globally for interaction updates
    globalState.data = rawData;

    // Create all three visualizations with initial reveal animations
    createBarChart(rawData);
    createLineChart(rawData);
    createSankeyDiagram(rawData);
}).catch(error => {
    console.error("Error loading data:", error);
});

function createBarChart(data) {
    // Process data for the bar chart - calculate average salary by experience level
    const expLevelOrder = ["EN", "MI", "SE", "EX"];
    const barData = expLevelOrder.map(level => {
        const levelData = data.filter(d => d.experience_level === level);
        const avgSalary = d3.mean(levelData, d => d.salary_in_usd);
        return {
            experience_level: level,
            experience_label: expLevelMap[level],
            avg_salary: avgSalary,
            count: levelData.length
        };
    });

    // Create SVG container for the bar chart
    const svg = d3.select("#barChart")
        .append("svg")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom)
        .append("g")
        .attr("transform", `translate(${barMargin.left},${barMargin.top})`);
        
    // Set up x-scale to position bars along the x-axis
    const x = d3.scaleBand()
        .domain(expLevelOrder)
        .range([0, barWidth])
        .padding(0.3);
        
    // Set up y-scale to determine bar heights based on salary values
    const y = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.avg_salary) * 1.1]) // Adding 10% padding at the top
        .range([barHeight, 0]);
        
    // Add x-axis with experience level labels, rotated for better readability
    svg.append("g")
        .attr("transform", `translate(0,${barHeight})`)
        .call(d3.axisBottom(x).tickFormat(d => expLevelMap[d]))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");
        
    // Add y-axis with dollar formatting for salary values
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickFormat(d => `$${d3.format(",.0f")(d)}`));
        
    // Add x-axis label
    svg.append("text")
        .attr("transform", `translate(${barWidth/2}, ${barHeight + 60})`)
        .style("text-anchor", "middle")
        .text("Experience Level (Click to Select/Deselect)");
        
    // Add y-axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -80)
        .attr("x", -barHeight / 2)
        .style("text-anchor", "middle")
        .text("Average Salary (USD)");
        
    // Add the bars with interactive selection and smooth animations
    const bars = svg.selectAll(".bar")
        .data(barData)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.experience_level))
        .attr("y", barHeight) // Start from bottom for animation
        .attr("width", x.bandwidth())
        .attr("height", 0) // Start with zero height for animation
        .attr("fill", d => expLevelColors[d.experience_level])
        .style("cursor", "pointer");

    // Animate bars growing from bottom to their final height
    bars.transition()
        .duration(ANIMATION_DURATION)
        .delay((d, i) => i * STAGGER_DELAY)
        .ease(d3.easeBackOut)
        .attr("y", d => y(d.avg_salary))
        .attr("height", d => barHeight - y(d.avg_salary));

    // Add selection interaction - click to toggle experience level selection
    bars.on("click", function(event, d) {
            if (globalState.isAnimating) return; // Prevent interaction during animations
            
            const level = d.experience_level;
            
            // Toggle selection state
            if (globalState.selectedExperienceLevels.has(level)) {
                globalState.selectedExperienceLevels.delete(level);
            } else {
                globalState.selectedExperienceLevels.add(level);
            }
            
            // Update visual state of all bars with smooth transitions
            updateBarSelection();
            
            // Update other visualizations based on new selection
            updateSankeyDiagram();
        })
        .on("mouseover", function(event, d) {
            // Show tooltip with detailed information on hover
            tooltip.style("opacity", 1);
            tooltip.html(`<strong>${d.experience_label}</strong><br>Average Salary: $${d3.format(",.0f")(d.avg_salary)}<br>Count: ${d.count} jobs<br><em>Click to ${globalState.selectedExperienceLevels.has(d.experience_level) ? 'deselect' : 'select'}</em>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
            
            // Subtle hover effect
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            // Hide tooltip and reset appearance
            tooltip.style("opacity", 0);
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 1);
        });
        
    // Add value labels on top of each bar with delayed animation
    const labels = svg.selectAll(".label")
        .data(barData)
        .join("text")
        .attr("class", "label")
        .attr("x", d => x(d.experience_level) + x.bandwidth() / 2)
        .attr("y", barHeight) // Start from bottom
        .attr("text-anchor", "middle")
        .style("opacity", 0)
        .text(d => `$${d3.format(",.0f")(d.avg_salary)}`);

    // Animate labels appearing after bars finish growing
    labels.transition()
        .delay(ANIMATION_DURATION + STAGGER_DELAY * 4)
        .duration(400)
        .ease(d3.easeBackOut)
        .attr("y", d => y(d.avg_salary) - 10)
        .style("opacity", 1);
        
    // Add count labels below each bar to show sample size
    const countLabels = svg.selectAll(".count-label")
        .data(barData)
        .join("text")
        .attr("class", "count-label")
        .attr("x", d => x(d.experience_level) + x.bandwidth() / 2)
        .attr("y", barHeight + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("opacity", 0)
        .text(d => `n = ${d.count}`);

    // Animate count labels with final delay
    countLabels.transition()
        .delay(ANIMATION_DURATION + STAGGER_DELAY * 5)
        .duration(400)
        .style("opacity", 1);

    // Function to update bar selection visual state
    function updateBarSelection() {
        svg.selectAll(".bar")
            .transition()
            .duration(300)
            .attr("class", d => {
                if (globalState.selectedExperienceLevels.has(d.experience_level)) {
                    return "bar selected";
                } else {
                    return "bar deselected";
                }
            });
    }
}

function createLineChart(data) {
    // Define years and experience levels for the line chart
    const years = [2020, 2021, 2022, 2023];
    const expLevels = ["EN", "MI", "SE", "EX"];
    
    // Calculate average salaries by year and experience level
    const lineData = [];
    years.forEach(year => {
        expLevels.forEach(level => {
            const filteredData = data.filter(d => d.work_year === year && d.experience_level === level);
            if (filteredData.length > 0) {
                const avgSalary = d3.mean(filteredData, d => d.salary_in_usd);
                lineData.push({
                    year: year,
                    experience_level: level,
                    experience_label: expLevelMap[level],
                    avg_salary: avgSalary,
                    count: filteredData.length
                });
            }
        });
    });

    // Create SVG container for the line chart
    const svg = d3.select("#lineChart")
        .append("svg")
        .attr("width", lineWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);
        
    // Group data by experience level for easier line creation
    const nestedData = d3.group(lineData, d => d.experience_level);
    
    // Set up x-scale for years
    const x = d3.scaleLinear()
        .domain(d3.extent(years))
        .range([0, lineWidth]);
        
    // Set up y-scale for salary values
    const y = d3.scaleLinear()
        .domain([0, d3.max(lineData, d => d.avg_salary) * 1.1])
        .range([lineHeight, 0]);
        
    // Add x-axis with year labels
    svg.append("g")
        .attr("transform", `translate(0,${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d => d.toString()).ticks(years.length));
        
    // Add y-axis with dollar formatting
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickFormat(d => `$${d3.format(",.0f")(d)}`));

    // Add brush for time range selection
    const brush = d3.brushX()
        .extent([[0, 0], [lineWidth, lineHeight]])
        .on("brush end", brushed);

    // Add brush to the chart
    const brushGroup = svg.append("g")
        .attr("class", "brush")
        .call(brush);

    // Brush event handler
    function brushed(event) {
        if (globalState.isAnimating) return; // Prevent interaction during animations
        
        const selection = event.selection;
        
        if (selection) {
            // Convert pixel coordinates to year values
            const [x0, x1] = selection.map(x.invert);
            globalState.selectedTimeRange = [Math.max(2020, Math.floor(x0)), Math.min(2023, Math.ceil(x1))];
        } else {
            // If no selection, reset to full range
            globalState.selectedTimeRange = [2020, 2023];
        }
        
        // Update other visualizations based on new time range
        updateSankeyDiagram();
    }
        
    // Create the line generator with a smooth curve
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.avg_salary))
        .curve(d3.curveMonotoneX);
        
    // Add x-axis label
    svg.append("text")
        .attr("transform", `translate(${lineWidth/2}, ${lineHeight + 45})`)
        .style("text-anchor", "middle")
        .text("Year (Brush to Select Time Range)");
        
    // Add y-axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -80)
        .attr("x", -lineHeight / 2)
        .style("text-anchor", "middle")
        .text("Average Salary (USD)");
        
    // Draw lines for each experience level with animated reveal
    nestedData.forEach((values, key) => {
        // Sort values by year for proper line drawing
        values.sort((a, b) => a.year - b.year);
        
        // Add the line path with animated drawing effect
        const path = svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", expLevelColors[key])
            .attr("stroke-width", 3)
            .attr("d", line);

        // Animate line drawing from left to right
        const totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(ANIMATION_DURATION)
            .delay(300 + expLevels.indexOf(key) * STAGGER_DELAY)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0);
            
        // Add data points with staggered animations
        svg.selectAll(`.point-${key}`)
            .data(values)
            .join("circle")
            .attr("class", `point-${key}`)
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.avg_salary))
            .attr("r", 0) // Start with zero radius
            .attr("fill", expLevelColors[key])
            .style("cursor", "pointer")
            .transition()
            .duration(400)
            .delay((d, i) => ANIMATION_DURATION + 300 + expLevels.indexOf(key) * STAGGER_DELAY + i * 100)
            .ease(d3.easeBackOut)
            .attr("r", 5);

        // Add interactivity to points after animation
        setTimeout(() => {
            svg.selectAll(`.point-${key}`)
                .on("mouseover", function(event, d) {
                    // Show tooltip with detailed information on hover
                    tooltip.style("opacity", 1);
                    tooltip.html(`<strong>${d.experience_label} (${d.year})</strong><br>Average Salary: $${d3.format(",.0f")(d.avg_salary)}<br>Count: ${d.count} jobs`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 20) + "px");
                    
                    // Enlarge the point with smooth animation
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 7);
                })
                .on("mouseout", function() {
                    // Hide tooltip and reset point size
                    tooltip.style("opacity", 0);
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 5);
                });
        }, ANIMATION_DURATION + 800);
    });
    
    // Add legend to identify experience levels with animated appearance
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${lineWidth - 150}, 0)`)
        .style("opacity", 0);
        
    expLevels.forEach((level, i) => {
        // Add colored rectangles for each experience level
        legend.append("rect")
            .attr("x", 0)
            .attr("y", i * 20)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", expLevelColors[level]);
            
        // Add text labels for each experience level
        legend.append("text")
            .attr("x", 25)
            .attr("y", i * 20 + 12)
            .text(expLevelMap[level]);
    });

    // Animate legend appearance
    legend.transition()
        .delay(ANIMATION_DURATION + 400)
        .duration(600)
        .style("opacity", 1);
}

function createSankeyDiagram(data) {
    // Create SVG container for the Sankey diagram
    const svg = d3.select("#sankeyDiagram")
        .append("svg")
        .attr("width", sankeyWidth + sankeyMargin.left + sankeyMargin.right)
        .attr("height", sankeyHeight + sankeyMargin.top + sankeyMargin.bottom)
        .append("g")
        .attr("transform", `translate(${sankeyMargin.left},${sankeyMargin.top})`);

    // Store SVG reference for updates
    globalState.sankeySvg = svg;
    
    // Initialize with all data
    updateSankeyDiagram();
}

function updateSankeyDiagram() {
    if (!globalState.data || !globalState.sankeySvg) return;
    
    globalState.isAnimating = true;
    
    // Filter data based on current selections
    const filteredData = globalState.data.filter(d => 
        globalState.selectedExperienceLevels.has(d.experience_level) &&
        d.work_year >= globalState.selectedTimeRange[0] &&
        d.work_year <= globalState.selectedTimeRange[1]
    );

    const svg = globalState.sankeySvg;
    const expLevels = ["EN", "MI", "SE", "EX"];
    
    // Find the top 10 job titles from filtered data to avoid cluttering the diagram
    const top10JobTitles = d3.rollups(
        filteredData,
        v => v.length,
        d => d.job_title
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(d => d[0]);
    
    // Define salary ranges for the right side of the Sankey diagram
    const salaryRanges = [
        "< $50K", 
        "$50K - $100K", 
        "$100K - $150K", 
        "$150K - $200K", 
        "$200K+"
    ];
    
    // Define colors for the salary ranges
    const salaryRangeColors = {
        "< $50K": "#66c2a5", 
        "$50K - $100K": "#fc8d62", 
        "$100K - $150K": "#8da0cb", 
        "$150K - $200K": "#e78ac3", 
        "$200K+": "#a6d854"
    };
    
    // Helper function to categorize salaries into ranges
    function getSalaryRange(salary) {
        if (salary < 50000) return "< $50K";
        if (salary < 100000) return "$50K - $100K";
        if (salary < 150000) return "$100K - $150K";
        if (salary < 200000) return "$150K - $200K";
        return "$200K+";
    }
    
    // Filter to only include top job titles
    const sankeyFilteredData = filteredData.filter(d => top10JobTitles.includes(d.job_title));
    
    // If no data after filtering, show empty state
    if (sankeyFilteredData.length === 0) {
        svg.selectAll("*").remove();
        svg.append("text")
            .attr("x", sankeyWidth / 2)
            .attr("y", sankeyHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .style("fill", "#999")
            .text("No data matches current selection");
        
        globalState.isAnimating = false;
        return;
    }
    
    // Prepare data structure for the Sankey diagram
    const sankeyData = {
        nodes: [
            ...expLevels.filter(level => globalState.selectedExperienceLevels.has(level))
                .map(level => ({ name: expLevelMap[level] })),
            ...top10JobTitles.map(title => ({ name: title })),
            ...salaryRanges.map(range => ({ name: range }))
        ],
        links: []
    };
    
    // Count connections between experience levels and job titles  
    const expToJob = d3.rollups(
        sankeyFilteredData,
        v => v.length,
        d => d.experience_level,
        d => d.job_title
    );
    
    // Count connections between job titles and salary ranges
    const jobToSalary = d3.rollups(
        sankeyFilteredData,
        v => v.length,
        d => d.job_title,
        d => getSalaryRange(d.salary_in_usd)
    );
    
    // Create index mappings for easier reference
    const selectedExpLevels = expLevels.filter(level => globalState.selectedExperienceLevels.has(level));
    const expLevelToIndex = {};
    selectedExpLevels.forEach((level, i) => {
        expLevelToIndex[level] = i;
    });
    
    const jobTitleToIndex = {};
    top10JobTitles.forEach((title, i) => {
        jobTitleToIndex[title] = i + selectedExpLevels.length;
    });
    
    const salaryRangeToIndex = {};
    salaryRanges.forEach((range, i) => {
        salaryRangeToIndex[range] = i + selectedExpLevels.length + top10JobTitles.length;
    });
    
    // Create links from experience levels to job titles
    expToJob.forEach(([expLevel, jobs]) => {
        if (globalState.selectedExperienceLevels.has(expLevel)) {
            jobs.forEach(([jobTitle, value]) => {
                sankeyData.links.push({
                    source: expLevelToIndex[expLevel],
                    target: jobTitleToIndex[jobTitle],
                    value: value
                });
            });
        }
    });
    
    // Create links from job titles to salary ranges
    jobToSalary.forEach(([jobTitle, salaries]) => {
        salaries.forEach(([salaryRange, value]) => {
            sankeyData.links.push({
                source: jobTitleToIndex[jobTitle],
                target: salaryRangeToIndex[salaryRange],
                value: value
            });
        });
    });
    
    // Initialize the Sankey diagram generator
    const sankey = d3.sankey()
        .nodeId(d => d.index)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[0, 0], [sankeyWidth, sankeyHeight]]);
    
    // Generate the Sankey layout
    const { nodes, links } = sankey(sankeyData);
    
    // Set up color scale for experience levels
    const colorScale = d3.scaleOrdinal()
        .domain(selectedExpLevels.map(level => expLevelMap[level]))
        .range(selectedExpLevels.map(level => expLevelColors[level]));
    
    // Clear previous content with fade out animation
    svg.selectAll("*")
        .transition()
        .duration(400)
        .style("opacity", 0)
        .remove();

    // Add new content after fade out completes
    setTimeout(() => {
        // Add nodes (rectangles) with appropriate coloring and animations
        const nodeRects = svg.append("g")
            .selectAll("rect")
            .data(nodes)
            .join("rect")
            .attr("class", "node")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", 0) // Start with zero height for animation
            .attr("width", d => d.x1 - d.x0)
            .attr("fill", d => {
                if (selectedExpLevels.map(level => expLevelMap[level]).includes(d.name)) {
                    return colorScale(d.name);
                } else if (salaryRanges.includes(d.name)) {
                    return salaryRangeColors[d.name];
                } else {
                    return "#bbb";
                }
            })
            .attr("stroke", "#000")
            .style("opacity", 0);

        // Animate nodes appearing
        nodeRects.transition()
            .duration(600)
            .delay((d, i) => i * 50)
            .ease(d3.easeBackOut)
            .attr("height", d => d.y1 - d.y0)
            .style("opacity", 1);

        // Add interactivity to nodes
        nodeRects.on("mouseover", function(event, d) {
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.name}</strong><br>Count: ${d.value}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });
        
        // Add text labels for each node
        const nodeLabels = svg.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .attr("x", d => d.x0 < sankeyWidth / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < sankeyWidth / 2 ? "start" : "end")
            .text(d => d.name)
            .style("font-size", "10px")
            .style("opacity", 0);

        // Animate labels appearing after nodes
        nodeLabels.transition()
            .delay(800)
            .duration(400)
            .style("opacity", 1);
        
        // Create link groups for the flow paths
        const linkPaths = svg.append("g")
            .attr("fill", "none")
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("class", "link")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => {
                const sourceName = nodes[d.source.index].name;
                if (selectedExpLevels.map(level => expLevelMap[level]).includes(sourceName)) {
                    return colorScale(sourceName);
                } else if (salaryRanges.includes(nodes[d.target.index].name)) {
                    return salaryRangeColors[nodes[d.target.index].name];
                } else {
                    return "#bbb";
                }
            })
            .attr("stroke-width", d => Math.max(1, d.width))
            .style("opacity", 0);

        // Animate links appearing with flowing effect
        linkPaths.transition()
            .delay(1000)
            .duration(800)
            .ease(d3.easeLinear)
            .style("opacity", 0.5);

        // Add interactivity to links
        linkPaths.on("mouseover", function(event, d) {
                // Show tooltip with link details on hover
                const sourceName = nodes[d.source.index].name;
                const targetName = nodes[d.target.index].name;
                
                tooltip.style("opacity", 1)
                    .html(`<strong>${sourceName} → ${targetName}</strong><br>Count: ${d.value}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
                    
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.8);
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.5);
            });
        
        // Add column labels for clarity
        const columnLabels = ["Experience Level", "Job Title", "Salary Range"];
        
        const labels = svg.selectAll(".column-label")
            .data(columnLabels)
            .join("text")
            .attr("class", "column-label")
            .attr("x", (d, i) => i === 0 ? 0 : (i === 1 ? sankeyWidth / 2 : sankeyWidth))
            .attr("y", -10)
            .attr("text-anchor", (d, i) => i === 0 ? "start" : (i === 1 ? "middle" : "end"))
            .attr("font-weight", "bold")
            .text(d => d)
            .style("opacity", 0);

        // Animate column labels
        labels.transition()
            .delay(600)
            .duration(400)
            .style("opacity", 1);
            
        // Add legend for salary ranges
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${sankeyWidth - 200}, ${sankeyHeight - 180})`)
            .style("opacity", 0);
        
        legend.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .attr("font-weight", "bold")
            .text("Salary Ranges");
        
        // Add color swatches and labels for each salary range
        salaryRanges.forEach((range, i) => {
            legend.append("rect")
                .attr("x", 0)
                .attr("y", i * 20)
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", salaryRangeColors[range]);
                
            legend.append("text")
                .attr("x", 25)
                .attr("y", i * 20 + 12)
                .text(range)
                .style("font-size", "12px");
        });

        // Animate legend appearing
        legend.transition()
            .delay(1200)
            .duration(400)
            .style("opacity", 1);

        // Reset animation flag after all animations complete
        setTimeout(() => {
            globalState.isAnimating = false;
        }, 1600);

    }, 400); 
}