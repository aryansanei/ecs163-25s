const width = window.innerWidth;
const height = window.innerHeight;

let barLeft = 0, barTop = 0;
let barMargin = {top: 60, right: 30, bottom: 80, left: 100},
    barWidth = d3.select('.overview').node().getBoundingClientRect().width - barMargin.left - barMargin.right,
    barHeight = 400 - barMargin.top - barMargin.bottom;

let lineLeft = 0, lineTop = 0;
let lineMargin = {top: 60, right: 30, bottom: 80, left: 100},
    lineWidth = d3.select('.trends').node().getBoundingClientRect().width - lineMargin.left - lineMargin.right,
    lineHeight = 400 - lineMargin.top - lineMargin.bottom;

let sankeyLeft = 0, sankeyTop = 0;
let sankeyMargin = {top: 20, right: 20, bottom: 20, left: 20},
    sankeyWidth = d3.select('.sankey').node().getBoundingClientRect().width - sankeyMargin.left - sankeyMargin.right,
    sankeyHeight = d3.select('.sankey').node().getBoundingClientRect().height - sankeyMargin.top - sankeyMargin.bottom;

const expLevelMap = {
    "EN": "Entry Level",
    "MI": "Mid Level",
    "SE": "Senior",
    "EX": "Executive"
};

const expLevelColors = {
    "EN": "#4e79a7",
    "MI": "#f28e2c",
    "SE": "#59a14f",
    "EX": "#e15759"
};

const tooltip = d3.select(".tooltip");

d3.csv("ds_salaries.csv").then(rawData => {
    rawData.forEach(d => {
        d.work_year = +d.work_year;
        d.salary = +d.salary;
        d.salary_in_usd = +d.salary_in_usd;
        d.remote_ratio = +d.remote_ratio;
    });

    createBarChart(rawData);
    createLineChart(rawData);
    createSankeyDiagram(rawData);
}).catch(error => {
    console.error("Error loading data:", error);
});

function createBarChart(data) {
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

    const svg = d3.select("#barChart")
        .append("svg")
        .attr("width", barWidth + barMargin.left + barMargin.right)
        .attr("height", barHeight + barMargin.top + barMargin.bottom)
        .append("g")
        .attr("transform", `translate(${barMargin.left},${barMargin.top})`);
        
    const x = d3.scaleBand()
        .domain(expLevelOrder)
        .range([0, barWidth])
        .padding(0.3);
        
    const y = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.avg_salary) * 1.1])
        .range([barHeight, 0]);
        
    svg.append("g")
        .attr("transform", `translate(0,${barHeight})`)
        .call(d3.axisBottom(x).tickFormat(d => expLevelMap[d]))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");
        
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickFormat(d => `$${d3.format(",.0f")(d)}`));
        
    svg.append("text")
        .attr("transform", `translate(${barWidth/2}, ${barHeight + 60})`)
        .style("text-anchor", "middle")
        .text("Experience Level");
        
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -80)
        .attr("x", -barHeight / 2)
        .style("text-anchor", "middle")
        .text("Average Salary (USD)");
        
    svg.selectAll(".bar")
        .data(barData)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.experience_level))
        .attr("y", d => y(d.avg_salary))
        .attr("width", x.bandwidth())
        .attr("height", d => barHeight - y(d.avg_salary))
        .attr("fill", d => expLevelColors[d.experience_level])
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1);
            tooltip.html(`<strong>${d.experience_label}</strong><br>Average Salary: $${d3.format(",.0f")(d.avg_salary)}<br>Count: ${d.count} jobs`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
            d3.select(this).attr("opacity", 1);
        });
        
    svg.selectAll(".label")
        .data(barData)
        .join("text")
        .attr("class", "label")
        .attr("x", d => x(d.experience_level) + x.bandwidth() / 2)
        .attr("y", d => y(d.avg_salary) - 10)
        .attr("text-anchor", "middle")
        .text(d => `$${d3.format(",.0f")(d.avg_salary)}`);
        
    svg.selectAll(".count-label")
        .data(barData)
        .join("text")
        .attr("class", "count-label")
        .attr("x", d => x(d.experience_level) + x.bandwidth() / 2)
        .attr("y", barHeight + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(d => `n = ${d.count}`);
}

function createLineChart(data) {
    const years = [2020, 2021, 2022, 2023];
    const expLevels = ["EN", "MI", "SE", "EX"];
    
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

    const svg = d3.select("#lineChart")
        .append("svg")
        .attr("width", lineWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);
        
    const nestedData = d3.group(lineData, d => d.experience_level);
    
    const x = d3.scaleLinear()
        .domain(d3.extent(years))
        .range([0, lineWidth]);
        
    const y = d3.scaleLinear()
        .domain([0, d3.max(lineData, d => d.avg_salary) * 1.1])
        .range([lineHeight, 0]);
        
    svg.append("g")
        .attr("transform", `translate(0,${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d => d.toString()).ticks(years.length));
        
    svg.append("g")
        .call(d3.axisLeft(y)
            .tickFormat(d => `$${d3.format(",.0f")(d)}`));
        
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.avg_salary))
        .curve(d3.curveMonotoneX);
        
    svg.append("text")
        .attr("transform", `translate(${lineWidth/2}, ${lineHeight + 45})`)
        .style("text-anchor", "middle")
        .text("Year");
        
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -80)
        .attr("x", -lineHeight / 2)
        .style("text-anchor", "middle")
        .text("Average Salary (USD)");
        
    nestedData.forEach((values, key) => {
        values.sort((a, b) => a.year - b.year);
        
        svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", expLevelColors[key])
            .attr("stroke-width", 3)
            .attr("d", line);
            
        svg.selectAll(`.point-${key}`)
            .data(values)
            .join("circle")
            .attr("class", `point-${key}`)
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.avg_salary))
            .attr("r", 5)
            .attr("fill", expLevelColors[key])
            .on("mouseover", function(event, d) {
                tooltip.style("opacity", 1);
                tooltip.html(`<strong>${d.experience_label} (${d.year})</strong><br>Average Salary: $${d3.format(",.0f")(d.avg_salary)}<br>Count: ${d.count} jobs`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
                d3.select(this).attr("r", 7);
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
                d3.select(this).attr("r", 5);
            });
    });
    
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${lineWidth - 150}, 0)`);
        
    expLevels.forEach((level, i) => {
        legend.append("rect")
            .attr("x", 0)
            .attr("y", i * 20)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", expLevelColors[level]);
            
        legend.append("text")
            .attr("x", 25)
            .attr("y", i * 20 + 12)
            .text(expLevelMap[level]);
    });
}

function createSankeyDiagram(data) {
    const svg = d3.select("#sankeyDiagram")
        .append("svg")
        .attr("width", sankeyWidth + sankeyMargin.left + sankeyMargin.right)
        .attr("height", sankeyHeight + sankeyMargin.top + sankeyMargin.bottom)
        .append("g")
        .attr("transform", `translate(${sankeyMargin.left},${sankeyMargin.top})`);
        
    const expLevels = ["EN", "MI", "SE", "EX"];
    
    const top10JobTitles = d3.rollups(
        data,
        v => v.length,
        d => d.job_title
    )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(d => d[0]);
    
    const salaryRanges = [
        "< $50K", 
        "$50K - $100K", 
        "$100K - $150K", 
        "$150K - $200K", 
        "$200K+"
    ];
    
    const salaryRangeColors = {
        "< $50K": "#66c2a5", 
        "$50K - $100K": "#fc8d62", 
        "$100K - $150K": "#8da0cb", 
        "$150K - $200K": "#e78ac3", 
        "$200K+": "#a6d854"
    };
    
    function getSalaryRange(salary) {
        if (salary < 50000) return "< $50K";
        if (salary < 100000) return "$50K - $100K";
        if (salary < 150000) return "$100K - $150K";
        if (salary < 200000) return "$150K - $200K";
        return "$200K+";
    }
    
    const sankeyData = {
        nodes: [
            ...expLevels.map(level => ({ name: expLevelMap[level] })),
            ...top10JobTitles.map(title => ({ name: title })),
            ...salaryRanges.map(range => ({ name: range }))
        ],
        links: []
    };
    
    const filteredData = data.filter(d => top10JobTitles.includes(d.job_title));
    
    const expToJob = d3.rollups(
        filteredData,
        v => v.length,
        d => d.experience_level,
        d => d.job_title
    );
    
    const jobToSalary = d3.rollups(
        filteredData,
        v => v.length,
        d => d.job_title,
        d => getSalaryRange(d.salary_in_usd)
    );
    
    const expLevelToIndex = {};
    expLevels.forEach((level, i) => {
        expLevelToIndex[level] = i;
    });
    
    const jobTitleToIndex = {};
    top10JobTitles.forEach((title, i) => {
        jobTitleToIndex[title] = i + expLevels.length;
    });
    
    const salaryRangeToIndex = {};
    salaryRanges.forEach((range, i) => {
        salaryRangeToIndex[range] = i + expLevels.length + top10JobTitles.length;
    });
    
    expToJob.forEach(([expLevel, jobs]) => {
        jobs.forEach(([jobTitle, value]) => {
            sankeyData.links.push({
                source: expLevelToIndex[expLevel],
                target: jobTitleToIndex[jobTitle],
                value: value
            });
        });
    });
    
    jobToSalary.forEach(([jobTitle, salaries]) => {
        salaries.forEach(([salaryRange, value]) => {
            sankeyData.links.push({
                source: jobTitleToIndex[jobTitle],
                target: salaryRangeToIndex[salaryRange],
                value: value
            });
        });
    });
    
    const sankey = d3.sankey()
        .nodeId(d => d.index)
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[0, 0], [sankeyWidth, sankeyHeight]]);
    
    const { nodes, links } = sankey(sankeyData);
    
    const colorScale = d3.scaleOrdinal()
        .domain(expLevels.map(level => expLevelMap[level]))
        .range([expLevelColors.EN, expLevelColors.MI, expLevelColors.SE, expLevelColors.EX]);
    
    svg.append("g")
        .selectAll("rect")
        .data(nodes)
        .join("rect")
        .attr("class", "node")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => {
            if (expLevels.map(level => expLevelMap[level]).includes(d.name)) {
                return colorScale(d.name);
            } else if (salaryRanges.includes(d.name)) {
                return salaryRangeColors[d.name];
            } else {
                return "#bbb";
            }
        })
        .attr("stroke", "#000")
        .on("mouseover", function(event, d) {
            tooltip.style("opacity", 1)
                .html(`<strong>${d.name}</strong><br>Count: ${d.value}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });
    
    svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("x", d => d.x0 < sankeyWidth / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < sankeyWidth / 2 ? "start" : "end")
        .text(d => d.name)
        .style("font-size", "10px");
    
    const link = svg.append("g")
        .attr("fill", "none")
        .selectAll("g")
        .data(links)
        .join("g");
    
    link.append("path")
        .attr("class", "link")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => {
            const sourceName = nodes[d.source.index].name;
            if (expLevels.map(level => expLevelMap[level]).includes(sourceName)) {
                return colorScale(sourceName);
            } else if (salaryRanges.includes(nodes[d.target.index].name)) {
                return salaryRangeColors[nodes[d.target.index].name];
            } else {
                return "#bbb";
            }
        })
        .attr("stroke-width", d => Math.max(1, d.width))
        .on("mouseover", function(event, d) {
            const sourceName = nodes[d.source.index].name;
            const targetName = nodes[d.target.index].name;
            
            tooltip.style("opacity", 1)
                .html(`<strong>${sourceName} → ${targetName}</strong><br>Count: ${d.value}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
                
            d3.select(this).attr("stroke-opacity", 0.8);
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
            d3.select(this).attr("stroke-opacity", 0.5);
        });
    
    const columnLabels = ["Experience Level", "Job Title", "Salary Range"];
    const columnX = [0, sankeyWidth / 2, sankeyWidth];
    
    svg.selectAll(".column-label")
        .data(columnLabels)
        .join("text")
        .attr("class", "column-label")
        .attr("x", (d, i) => i === 0 ? 0 : (i === 1 ? sankeyWidth / 2 : sankeyWidth))
        .attr("y", -10)
        .attr("text-anchor", (d, i) => i === 0 ? "start" : (i === 1 ? "middle" : "end"))
        .attr("font-weight", "bold")
        .text(d => d);
        
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${sankeyWidth - 200}, ${sankeyHeight - 180})`);
    
    legend.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-weight", "bold")
        .text("Salary Ranges");
    
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
}