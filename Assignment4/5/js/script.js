function createVis(data) {
  const width = 1200;
  const height = 800;
  const color = d3.scaleOrdinal(d3.schemeCategory10);


  // Create the SVG container.
  const svg = d3.select("#vis").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");
}

function init() {
    d3.json("./data/colors.json").then(data => {
        console.log(data);
        createVis(data);
    })

    .catch(error => console.error('Error loading data:', error));
        d3.json("./data/flare-2.json")
        .then(data => createTree(data))
        .catch(error => console.error('Error loading flare-2.json:', error));

}

window.addEventListener('load', init);