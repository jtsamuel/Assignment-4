const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 1000 - margin.left - margin.right;
const height = 800 - margin.top - margin.bottom;

let allData = [];
let regionalAverages = [];
let xScale, yScale, sizeScale;
let normalizedData = {};
const TWO_PI = 2 * Math.PI;

const options = [
  "Americas",
  "East Asia & Pacific",
  "Europe & Central Asia",
  "Middle East & North Africa",
  "South Asia",
  "Sub-Saharan Africa",
];

// This map links the original CSV header to the clean display name, which now acts as the internal data key. --> Ai here
const CSV_TO_DISPLAY_MAP = {
  "GDP growth (annual %)": "GDP Growth (Ann %)",
  "health expenditure % of GDP": "Health Exp. (% GDP)",
  "education expenditure % of GDP": "Educ. Exp. (% GDP)",
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

const DISPLAY_METRIC_NAMES = Object.values(CSV_TO_DISPLAY_MAP).filter(
  (d) => d !== "Region",
);

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

let RegionVar = "Americas";
let innerRadius = 130;
const new_outerRadius = Math.min(width, height) / 2 + 50;

const tooltip = d3
  .select("body")
  .append("div")
  .attr("class", "radial-tooltip")
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("padding", "6px 10px")
  .style("border-radius", "4px")
  .style("font-size", "12px")
  .style("background", "rgba(255, 255, 255, 0.95)")
  .style("border", "1px solid #ccc")
  .style("color", "#333")
  .style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
  .style("opacity", 0);

// --- SVG Setup ---
const svg = d3
  .select("#vis")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr(
    "transform",
    `translate(${width / 2 + margin.left}, ${height / 2 + margin.top})`,
  );

const axesGroup = svg.append("g").attr("class", "axes-group");
const centerTextGroup = svg.append("g").attr("class", "center-text-group");

function calculateMetricRanges(data) {
  const ranges = {};
  const metricKeys = DISPLAY_METRIC_NAMES;

  metricKeys.forEach((key) => {
    const values = data.map((d) => d[key]);
    ranges[key] = {
      min: 0,
      max: d3.max(values),
    };
  });
  return ranges;
}

function init() {
  function dataParser(d) {
    const parsed = {};
    Object.keys(d).forEach((csvHeader) => {
      const displayKey = CSV_TO_DISPLAY_MAP[csvHeader];

      if (csvHeader === "Region") {
        parsed["region"] = d[csvHeader];
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
      regionalAverages = avgData.filter((d) => options.includes(d.region));
      metricRanges = calculateMetricRanges(regionalAverages);

      setupSelector();

      updateVis();
    })
    .catch((error) => console.error("Error loading data:", error));
}

function setupSelector() {
  d3.select("#Region").property("value", RegionVar);
  d3.selectAll(".variable")
    .each(function () {
      d3.select(this)
        .selectAll("myOptions")
        .data(options)
        .enter()
        .append("option")
        .text((d) => d)
        .attr("value", (d) => d);
    })
    .on("change", function (event) {
      if (d3.select(this).property("id") == "Region") {
        RegionVar = d3.select(this).property("value");
      }
      updateVis();
    });
}
function orderMetricsByPerformance() {
  const currentRegionRow = regionalAverages.find((d) => d.region === RegionVar);
  const otherRegionsData = regionalAverages.filter(
    (d) => d.region !== RegionVar,
  );

  if (!currentRegionRow || otherRegionsData.length === 0) {
    return {
      betterMetrics: DISPLAY_METRIC_NAMES,
      worseMetrics: [],
      percentageMetric: 0,
    };
  }

  const betterMetrics = [];
  const worseMetrics = [];
  const numOthers = otherRegionsData.length;

  DISPLAY_METRIC_NAMES.forEach((displayKey) => {
    const internalKey = displayKey;

    const sumOfOthers = otherRegionsData.reduce(
      (sum, d) => sum + d[internalKey],
      0,
    );
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
  // Return a new array with normalized values (0-100)
  return regionalAverages.map((d) => {
    const normalizedRow = { region: d.region };

    DISPLAY_METRIC_NAMES.forEach((key) => {
      const val = d[key];
      const min = metricRanges[key].min;
      const max = metricRanges[key].max;

      // 1. Normalize the value to 0-100
      let score = 0;
      if (max !== min) {
        score = ((val - min) / (max - min)) * 100;
      } else {
        score = 50; // Default if all values are the same
      }

      // 2. Add "Jitter" to avoid perfect overlap (Rubric Requirement)
      // We add a random offset between -3 and +3
      const jitter = (Math.random() - 0.5) * 6;

      // Ensure we stay within 0-100 bounds roughly
      score = Math.max(0, Math.min(100, score + jitter));

      normalizedRow[key] = score;

      // 3. Store the ORIGINAL value for the tooltip
      // We use a specific naming convention to access it later
      normalizedRow[`${key}_original`] = val;
    });

    return normalizedRow;
  });
}
function updateAxes() {
  const currentOuterRadius = new_outerRadius;

  normalizedData = calculateComparisonScores();

  const { betterMetrics, worseMetrics } = orderMetricsByPerformance();
  const sortedDomain = betterMetrics.concat(worseMetrics);

  const new_xScale = d3.scaleBand().domain(sortedDomain).range([0, TWO_PI]);

  const new_yScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([innerRadius, currentOuterRadius]);

  return {
    xScale: new_xScale,
    yScale: new_yScale,
  };
}

function drawAxes(axisData) {
  const { xScale, yScale } = axisData;

  const metrics = xScale.domain();
  const innerR = innerRadius;
  const outerR = d3.max(yScale.range());
  // helper: angle for each metric, with 0 at top (to match your band)
  function axisAngle(d) {
    return xScale(d) + xScale.bandwidth() / 2 - Math.PI / 2;
  }

  // -------------------------------
  // Add invisible wedge backgrounds
  // -------------------------------
  const wedgeArc = d3
    .arc()
    .innerRadius(innerRadius)
    .outerRadius(new_outerRadius);

  const wedges = axesGroup.selectAll(".metric-wedge").data(metrics, (d) => d);

  wedges.join(
    (enter) =>
      enter
        .append("path")
        .attr("class", "metric-wedge")
        .attr("fill", "transparent")
        .attr("pointer-events", "all")
        .on("mouseover", (event, d) => highlightMetric(d))
        .on("mouseout", unhighlightMetric)
        .attr("d", (d) => {
          const start = xScale(d);
          const end = xScale(d) + xScale.bandwidth();
          return wedgeArc({ startAngle: start, endAngle: end });
        }),
    (update) =>
      update.attr("d", (d) => {
        const start = xScale(d);
        const end = xScale(d) + xScale.bandwidth();
        return wedgeArc({ startAngle: start, endAngle: end });
      }),
    (exit) => exit.remove(),
  );

  // -------------------------
  // 1. Radial axis lines
  // -------------------------
  const axisLines = axesGroup.selectAll(".metric-axis").data(metrics, (d) => d);

  axisLines.join(
    (enter) =>
      enter
        .append("line")
        .attr("class", "metric-axis")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1)
        .attr("x1", (d) => innerR * Math.cos(axisAngle(d)))
        .attr("y1", (d) => innerR * Math.sin(axisAngle(d)))
        .attr("x2", (d) => outerR * Math.cos(axisAngle(d)))
        .attr("y2", (d) => outerR * Math.sin(axisAngle(d))),
    (update) =>
      update
        .attr("x1", (d) => innerR * Math.cos(axisAngle(d)))
        .attr("y1", (d) => innerR * Math.sin(axisAngle(d)))
        .attr("x2", (d) => outerR * Math.cos(axisAngle(d)))
        .attr("y2", (d) => outerR * Math.sin(axisAngle(d))),
    (exit) => exit.remove(),
  );

  // -------------------------
  // 2. Labels ON the lines, rotated WITH the lines
  // -------------------------
  const tPos = 0.55; // ~55% from inner toward outer
  const labelRadius = innerR + (outerR - innerR) * tPos;

  const labels = axesGroup.selectAll(".metric-label").data(metrics, (d) => d);

  labels.join(
    (enter) => {
      const lbl = enter
        .append("text")
        .attr("class", "metric-label")
        .attr("x", 0)
        .attr("y", 0)

        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "hanging")
        .style("font-size", "15px")
        .style("text-transform", "uppercase")
        .style("margin-top", "35px")
        .style("fill", "#555")
        .on("mouseover", (event, d) => highlightMetric(d))
        .on("mouseout", unhighlightMetric)
        .attr("x", (d) => labelRadius * Math.cos(axisAngle(d)))
        .attr("y", (d) => labelRadius * Math.sin(axisAngle(d)))
        // rotate AROUND that (x,y) so the text sits along the line
        .attr("transform", (d) => {
          const a = (axisAngle(d) * 180) / Math.PI;
          const x = labelRadius * Math.cos(axisAngle(d));
          const y = labelRadius * Math.sin(axisAngle(d));
          return `rotate(${a}, ${x}, ${y})`;
        })
        .text((d) => d);

      return lbl;
    },
    (update) =>
      update
        .attr("x", (d) => labelRadius * Math.cos(axisAngle(d)))
        .attr("y", (d) => labelRadius * Math.sin(axisAngle(d)))
        .attr("transform", (d) => {
          const a = (axisAngle(d) * 180) / Math.PI;
          const x = labelRadius * Math.cos(axisAngle(d));
          const y = labelRadius * Math.sin(axisAngle(d));
          return `rotate(${a}, ${x}, ${y})`;
        })
        .text((d) => d),
    (exit) => exit.remove(),
  );
  const gridValues = [25, 50, 75, 100];

  const grids = axesGroup.selectAll(".radial-grid").data(gridValues);

  grids.join(
    (enter) =>
      enter
        .append("circle")
        .attr("class", "radial-grid")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", (d) => yScale(d))
        .attr("fill", "none")
        .attr("stroke", "#f0f0f0")
        .attr("stroke-width", 1),
    (update) => update.attr("r", (d) => yScale(d)),
    (exit) => exit.remove(),
  );
}

function drawband() {
  const currentOuterRadius = new_outerRadius;
  const { percentageMetric } = orderMetricsByPerformance();
  const betterEndAngle = percentageMetric * 2 * Math.PI;
  const worseStartAngle = betterEndAngle;

  const arcBand = d3
    .arc()
    .innerRadius(currentOuterRadius + 7)
    .outerRadius(currentOuterRadius + 15);

  // BETTER ARC
  // print the better arc, which goes from 0 to betterEndAngle
  // This is the main purple arc
  axesGroup
    .selectAll(".arc-better")
    .data([{ startAngle: 0, endAngle: betterEndAngle }])
    .join("path")
    .attr("class", "arc-better")
    .attr("stroke", "none")
    .attr("fill", "purple")
    .transition()
    .duration(500)
    .attrTween("d", function (d) {
      const previous = this._current || { startAngle: 0, endAngle: 0 };
      const i = d3.interpolate(previous, d);
      this._current = d;
      return (t) => arcBand(i(t));
    });

  // WORSE ARC
  axesGroup
    .selectAll(".arc-worse")
    .data([{ startAngle: worseStartAngle, endAngle: 2 * Math.PI }])
    .join("path")
    .attr("class", "arc-worse")
    .attr("stroke", "none")
    .attr("fill", "#b9b4b4")
    .transition()
    .duration(500)
    .attrTween("d", function (d) {
      const previous = this._current || { startAngle: 0, endAngle: 0 };
      const i = d3.interpolate(previous, d);
      this._current = d;
      return (t) => arcBand(i(t));
    });

  centerTextGroup
    .selectAll(".center-percent-value")
    .data([percentageMetric])
    .join("text")
    .attr("class", "center-percent-value")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("y", -10)
    .style("font-size", "50px")
    .style("font-weight", "bold")
    .text((d) => `${(d * 100).toFixed(1)}%`);

  centerTextGroup
    .selectAll(".center-percent-label")
    .data(["of metrics are stronger than the"])
    .join("text")
    .attr("class", "center-percent-label")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("y", 15)
    .style("font-size", "12px")
    .style("fill", "#666")
    .text((d) => d);

  centerTextGroup
    .selectAll(".center-percent-label2")
    .data(["average of other Regions"])
    .join("text")
    .attr("class", "center-percent-label2")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("y", 30)
    .style("font-size", "12px")
    .style("fill", "#666")
    .text((d) => d);
}

function drawlinesandBubbles() {
  if (!xScale || !yScale) return;

  const metrics = xScale.domain();
  const bubbleRadius = 6;

  const allCircleData = [];
  const linesData = [];

  metrics.forEach((metric) => {
    const range = metricRanges[metric] || { max: 1 };
    const maxVal = range.max || 1;
    const polarity = METRIC_POLARITY[metric] || 1;

    // ---- 1. Build per-metric region data (using averaged values) ----
    const metricRegionData = options.map((regionName) => {
      const row = regionalAverages.find((d) => d.region === regionName);
      const raw = row ? row[metric] : 0;

      // normalize 0–100
      let normalized = (raw / maxVal) * 100;
      if (polarity === -1) normalized = 100 - normalized;

      return {
        region: regionName,
        metric,
        value: raw,
        normalized,
      };
    });

    // ---- 2. Geometry for this metric axis ----
    const angle = xScale(metric) + xScale.bandwidth() / 2 - Math.PI / 2; // 0 at top
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);

    metricRegionData.sort(
      (a, b) => options.indexOf(a.region) - options.indexOf(b.region),
    );

    const n = metricRegionData.length;
    // Small padding to avoid touching
    const padding = 0.1;
    const offsetStep = 2 * bubbleRadius + padding;

    // ---- 3. Position bubbles with perpendicular offsets (no overlap) ----
    metricRegionData.forEach((d, i) => {
      const offsetIndex = i - (n - 1) / 2; // symmetric around axis
      const offset = offsetIndex * offsetStep;

      // Make sure the smaller circles do not touch the larger highlighted circle
      const r = yScale(d.normalized) - 10;

      const baseX = r * Math.cos(angle);
      const baseY = r * Math.sin(angle);

      d.cx = baseX + offset * tangentX;
      d.cy = baseY + offset * tangentY;
      d.angle = angle;

      allCircleData.push(d);
    });

    // ---- 4. Data for dashed distribution line (min ↔ max for this metric) ----
    const normVals = metricRegionData.map((d) => d.normalized);
    const rMin = yScale(d3.min(normVals));
    const rMax = yScale(d3.max(normVals));

    linesData.push({
      metric,
      angle,
      rMin,
      rMax,
    });
  });

  // ---- 5. Draw dashed lines for each metric distribution ----
  const distLines = axesGroup
    .selectAll(".metric-distribution")
    .data(linesData, (d) => d.metric);

  distLines.join(
    (enter) =>
      enter
        .append("line")
        .attr("class", "metric-distribution")
        .attr("stroke", "#c0c0c0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2")
        .attr("fill", "none")
        .attr("x1", (d) => d.rMin * Math.cos(d.angle))
        .attr("y1", (d) => d.rMin * Math.sin(d.angle))
        .attr("x2", (d) => d.rMax * Math.cos(d.angle))
        .attr("y2", (d) => d.rMax * Math.sin(d.angle)),
    (update) =>
      update
        .attr("x1", (d) => d.rMin * Math.cos(d.angle))
        .attr("y1", (d) => d.rMin * Math.sin(d.angle))
        .attr("x2", (d) => d.rMax * Math.cos(d.angle))
        .attr("y2", (d) => d.rMax * Math.sin(d.angle)),
    (exit) => exit.remove(),
  );

  // ---- 6. Draw the region bubbles ----
  const circles = axesGroup
    .selectAll(".region-bubble")
    .data(allCircleData, (d) => `${d.metric}-${d.region}`);

  circles.join(
    (enter) =>
      enter
        .append("circle")
        .attr("class", "region-bubble")
        .attr("r", bubbleRadius)
        .attr("cx", (d) => d.cx)
        .attr("cy", (d) => d.cy)
        .attr("fill", (d) => (d.region === RegionVar ? "#ffe4ff" : "white"))
        .attr("stroke", (d) => (d.region === RegionVar ? "purple" : "#a0a0a0"))
        .attr("r", (d) =>
          d.region === RegionVar ? bubbleRadius * 1.2 : bubbleRadius,
        )
        .attr("stroke-width", 2)
        .on("mouseover", (event, d) => {
          if (typeof highlightMetric === "function") {
            highlightMetric(d.metric);
          }

          tooltip.style("opacity", 1).html(createTooltip(d));
        })
        .on("mousemove", (event, d) => {
          tooltip
            .style("left", event.pageX + 12 + "px")
            .style("top", event.pageY + 12 + "px");
        })
        .on("mouseout", (event, d) => {
          if (typeof unhighlightMetric === "function") {
            unhighlightMetric();
          }
          tooltip.style("opacity", 0);
        }),

    (update) =>
      update
        .transition()
        .duration(500)
        .attr("cx", (d) => d.cx)
        .attr("cy", (d) => d.cy)
        .attr("fill", (d) => (d.region === RegionVar ? "#ffe4ff" : "white"))
        .attr("stroke", (d) => (d.region === RegionVar ? "purple" : "#a0a0a0"))
        .attr("r", (d) =>
          d.region === RegionVar ? bubbleRadius * 1.2 : bubbleRadius,
        ),
    (exit) => exit.remove(),
  );

  // Keep selected region on top
  axesGroup
    .selectAll(".region-bubble")
    .filter((d) => d.region === RegionVar)
    .raise();
}

function updateVis() {
  const axisData = updateAxes();
  xScale = axisData.xScale;
  yScale = axisData.yScale;

  drawAxes(axisData);

  drawband();
  drawlinesandBubbles();
}

function highlightMetric(metric) {
  axesGroup
    .selectAll(".metric-wedge")
    .attr("fill", (d) => (d === metric ? "#e5e5e5" : "transparent"));
}

function unhighlightMetric() {
  axesGroup.selectAll(".metric-wedge").attr("fill", "transparent");
}

function createTooltip(data) {
  return `<div><strong>${data.metric}</strong></div>
            <div>${data.region}</div>
            <div>Value: ${data.normalized != null ? data.normalized.toFixed(2) + "%" : "N/A"}</div>`;
}

window.addEventListener("load", init);
