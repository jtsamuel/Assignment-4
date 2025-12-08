const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 1000 - margin.left - margin.right;
const height = 800 - margin.top - margin.bottom;

let allData = [];
let regionalAverages = [];
let xScale, yScale, sizeScale; 
let normalizedData = {}; 
const TWO_PI = 2 * Math.PI;

const options = ['Americas', 'East Asia & Pacific', 'Europe & Central Asia', 'Middle East & North Africa', 'South Asia', 'Sub-Saharan Africa'];

// This map links the original CSV header to the clean display name, which now acts as the internal data key. --> Ai here 
const CSV_TO_DISPLAY_MAP = {
    "GDP growth\n(annual %)": "GDP Growth (Ann %)", 
    "health expenditure \n% of GDP": "Health Exp. (% GDP)",
    "education expenditure\n% of GDP": "Educ. Exp. (% GDP)",
    "Education as % of GDP": "Education (% GDP)",
    "% of primary school aged kids out of school": "Primary Out of School (%)",
    "unemployment (%)": "Unemployment (%)",
    "Military Spending as % of GDP": "Military Spending (% GDP)",
    "% of population in extreme poverty": "Extreme Poverty (%)",
    "% of population with access to electricity": "Access to Elec. (%)", 
    "government expenditure (% of GDP)": "Gov. Expenditure (% GDP)",
    "share of electricity from renewables generation": "Renewables (%)",
    "% of seats held by women in national parliaments": "Women in Parliament (%)",
};

const DISPLAY_METRIC_NAMES = Object.values(CSV_TO_DISPLAY_MAP).filter(d => d !== 'Region');

// --- CONSTANT: Defines whether higher values are better (1) or worse (-1) --- Ai here
const METRIC_POLARITY = {
    "GDP Growth (Ann %)": 1,
    "Health Exp. (% GDP)": 1,
    "Educ. Exp. (% GDP)": 1,
    "Education (% GDP)": 1,
    "Access to Elec. (%)": 1,
    "Gov. Expenditure (% GDP)": 1,
    "Renewables (%)": 1,
    "Women in Parliament (%)": 1,
    // Metrics where a lower value is better
    "Primary Out of School (%)": -1, 
    "Unemployment (%)": -1,
    "Extreme Poverty (%)": -1,
    "Military Spending (% GDP)": -1, 
};

let metricRanges = {}; 

let RegionVar = 'Americas';
let innerRadius = 130;
const new_outerRadius = Math.min(width, height) / 2 - 20; 

// --- SVG Setup ---
const svg = d3.select("#vis")
    .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform", `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`);

const axesGroup = svg.append("g").attr("class", "axes-group");
const centerTextGroup = svg.append("g").attr("class", "center-text-group");


function calculateMetricRanges(data) {
    const ranges = {};
    const metricKeys = DISPLAY_METRIC_NAMES;

    metricKeys.forEach(key => {
        const values = data.map(d => d[key]);
        ranges[key] = {
            min: 0, 
            max: d3.max(values)
        };
    });
    return ranges;
}

function init(){
    function dataParser(d) {
        const parsed = {};
        Object.keys(d).forEach(csvHeader => {
            const displayKey = CSV_TO_DISPLAY_MAP[csvHeader]; 
            
            if (csvHeader === 'Region') {
                parsed['region'] = d[csvHeader]; 
            } else if (displayKey) {
                parsed[displayKey] = +d[csvHeader] || 0; 
            }
        });
        return parsed;
    }
    
    const countryDataPromise = d3.csv("./data/data.csv", dataParser);
    const averageDataPromise = d3.csv("./data/Averagedata.csv", dataParser);
    //AI used for this line
    Promise.all([countryDataPromise, averageDataPromise])
        .then(([countryData, avgData]) => {
            allData = countryData;
            regionalAverages = avgData.filter(d => options.includes(d.region)); 
            metricRanges = calculateMetricRanges(regionalAverages);

            setupSelector();
            
            updateVis(); 
        })
        .catch(error => console.error('Error loading data:', error));
}

function setupSelector(){
    d3.select('#Region').property('value', RegionVar)
    d3.selectAll('.variable')
        .each(function() {
            d3.select(this).selectAll('myOptions')
            .data(options)
            .enter()
            .append('option')
            .text(d => d) 
            .attr("value",d => d) 
        })
        .on("change", function (event) {
            if (d3.select(this).property("id") == "Region") {
                RegionVar = d3.select(this).property("value") 
            }
            updateVis();
    })
}
function orderMetricsByPerformance() {
    const currentRegionRow = regionalAverages.find(d => d.region === RegionVar);
    const otherRegionsData = regionalAverages.filter(d => d.region !== RegionVar);

    if (!currentRegionRow || otherRegionsData.length === 0) {
        return { betterMetrics: DISPLAY_METRIC_NAMES, worseMetrics: [], percentageMetric: 0 };
    }

    const betterMetrics = [];
    const worseMetrics = [];
    const numOthers = otherRegionsData.length;

    DISPLAY_METRIC_NAMES.forEach(displayKey => {
        const internalKey = displayKey; 
        
        const sumOfOthers = otherRegionsData.reduce((sum, d) => sum + d[internalKey], 0);
        const averageOfOthers = sumOfOthers / numOthers;
        const currentValue = currentRegionRow[internalKey];
        
        const polarity = METRIC_POLARITY[displayKey] || 1; 

        if (polarity === 1) { 
            if (currentValue > averageOfOthers) {
                betterMetrics.push(displayKey);
            } else {
                worseMetrics.push(displayKey);
            }
        } else {
            if (currentValue < averageOfOthers) {
                betterMetrics.push(displayKey);
            } else {
                worseMetrics.push(displayKey);
            }
        }
    });
    
    const totalMetrics = DISPLAY_METRIC_NAMES.length; // Use the actual count
    let percentageMetric = 0;
    if (totalMetrics > 0) {
         percentageMetric = betterMetrics.length / totalMetrics; // Use totalMetrics
    }

    return { betterMetrics, worseMetrics, percentageMetric };
}

function calculateComparisonScores() {
}

function updateAxes() {
    const currentOuterRadius = new_outerRadius; 
    
    normalizedData = calculateComparisonScores();

    const { betterMetrics, worseMetrics } = orderMetricsByPerformance();
    const sortedDomain = betterMetrics.concat(worseMetrics);

    const new_xScale = d3.scaleBand()
        .domain(sortedDomain) 
        .range([0, TWO_PI]);

    const new_yScale = d3.scaleLinear()
        .domain([0, 100]) 
        .range([innerRadius, currentOuterRadius]);

    return {
        xScale: new_xScale,
        yScale: new_yScale,
    };
}


function drawAxes(axisData) {
}

function drawband(){
    const currentOuterRadius = new_outerRadius; 
    const { percentageMetric } = orderMetricsByPerformance();
    const betterEndAngle = percentageMetric * 2 * Math.PI; 
    const worseStartAngle = betterEndAngle; 

    axesGroup.selectAll(".arc-better")
        .data([1]) 
        .join("path")
            .attr("class", "arc-better")
            .transition().duration(500)
            .attr("d", d3.arc()
                .innerRadius(currentOuterRadius + 5) 
                .outerRadius(currentOuterRadius + 10) 
                .startAngle(0)
                .endAngle(betterEndAngle)  
            )
            .attr('stroke', 'none')
            .attr('fill', 'purple');    
    axesGroup.selectAll(".arc-worse")
        .data([1]) 
        .join("path")
            .attr("class", "arc-worse")
            .transition().duration(500)
            .attr("d", d3.arc()
                .innerRadius(currentOuterRadius + 5) 
                .outerRadius(currentOuterRadius + 10)
                .startAngle(worseStartAngle)
                .endAngle( 2 * Math.PI ) 
            )
            .attr('stroke', 'none')
            .attr('fill', '#b9b4b4');    

    centerTextGroup.selectAll(".center-percent-value") 
        .data([percentageMetric])
        .join("text")
            .attr("class", "center-percent-value")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("y", -10)
            .style("font-size", "28px")
            .style("font-weight", "bold")
            .text(d => `${(d * 100).toFixed(1)}%`); 

    centerTextGroup.selectAll(".center-percent-label")
        .data(['of metrics are stronger than the']) 
        .join("text")
            .attr("class", "center-percent-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("y", 15)
            .style("font-size", "12px")
            .style("fill", "#666")
            .text(d => d);
    centerTextGroup.selectAll(".center-percent-label2")
        .data(['average of other Regions']) 
        .join("text")
            .attr("class", "center-percent-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("y", 30)
            .style("font-size", "12px")
            .style("fill", "#666")
            .text(d => d);
}

function drawlinesandBubbles(){
}

function updateVis(){ 
    // 1. Recalculate scales and update global variables (xScale, yScale)
    const axisData = updateAxes(); 
    xScale = axisData.xScale;
    yScale = axisData.yScale;
    
    drawAxes(axisData);
    
    drawband();
    
}

window.addEventListener('load', init);
