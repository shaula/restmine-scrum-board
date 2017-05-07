<template>
  <div id="velocityHistory">
    <span v-show="!velocity.length" class="icon icon-loader"></span>
    <svg v-show="velocity.length" class="chart" width="800" height="400"></svg>
  </div>
</template>

<style>
  #velocityHistory .bar {
    fill: steelblue;
  }

  #velocityHistory .bar:hover {
    fill: brown;
  }

  #velocityHistory .axis--x path {
    display: none;
  }

  #velocityHistory .x.axis path {
    display: none;
  }

  #velocityHistory .line {
    fill: none;
    stroke: #444;
    stroke-width: 1.5px;
  }

  #velocityHistory .line:hover {
    fill: brown;
  }
</style>

<script>
  const d3 = require('d3')

  export default {
    name: 'VelocityHistory',
    props: ['velocity'],
    watch: {
      velocity (data) {
        if (!data || !data.length) {
          return
        }

        if (!this.svg) {
          this.svg = this.initChart()
        }
        this.updateChart(this.svg, data)
      }
    },
    methods: {
      initChart () {
        // set up chart (based on https://bl.ocks.org/syncopika/f1c9036b0deb058454f825238a95b6be)
        const margin = {top: 20, right: 20, bottom: 50, left: 50}

        const width = d3.select('.chart').attr('width') - margin.left - margin.right
        const height = d3.select('.chart').attr('height') - margin.top - margin.bottom

        const svg = d3.select('.chart')
          .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

        const xChart = d3.scaleBand().range([0, width])
        const x2Chart = d3.scaleOrdinal([0, width])
        const yChart = d3.scaleLinear().range([height, 0])

        let xAxis = d3.axisBottom(xChart)
        let yAxis = d3.axisLeft(yChart)

        // set up axes
        // left axis
        svg.append('g')
          .attr('class', 'y axis')
          .call(yAxis)

        // bottom axis
        svg.append('g')
          .attr('class', 'xAxis')
          .attr('transform', 'translate(0,' + height + ')')
          .call(xAxis)
          .selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .attr('transform', function (d) {
            return 'rotate(-65)'
          })

        // add labels
        svg
          .append('text')
          .attr('transform', 'translate(-35,' + (height + margin.bottom) / 2 + ') rotate(-90)')
          .text('Story Points')

        svg
          .append('text')
          .attr('transform', 'translate(' + (width / 2) + ',' + (height + margin.bottom - 5) + ')')
          .text('Velocity')

        return {
          xChart: xChart,
          x2Chart: x2Chart,
          xAxis: xAxis,
          yAxis: yAxis,
          yChart: yChart,
          svg: svg,
          width: width,
          height: height,
          margin: margin
        }
      },
      updateChart (chart, data) {
        // set domain for the x axis
        chart.xChart.domain(data.map(function (d) { return d.sprintNumber }))
        chart.x2Chart.domain(data.map(function (d) { return d.sprintNumber }))

        // set domain for y axis
        chart.yChart.domain([0, d3.max(data, function (d) { return +d.velocity })])

        // get the width of each bar
        let barWidth = chart.width / data.length

        // select all bars on the graph, take them out, and exit the previous data set.
        // then you can add/enter the new data set
        let bars = chart.svg.selectAll('.bar')
          .remove()
          .exit()
          .data(data)

        // now actually give each rectangle the corresponding data
        bars.enter()
          .append('rect')
          .attr('class', 'bar')
          .attr('x', function (d, i) { return i * barWidth + 1 })
          .attr('y', function (d) { return chart.yChart(d.velocity) })
          .attr('height', function (d) { return chart.height - chart.yChart(d.velocity) })
          .attr('width', barWidth - 1)
          .attr('fill', function (d) {
            return 'rgb(179,205,227)'
          })

        // left axis
        chart.svg.select('.y')
          .call(chart.yAxis)

        // bottom axis
        chart.svg.select('.xAxis')
          .attr('transform', 'translate(0,' + chart.height + ')')
          .call(chart.xAxis)
          .selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .attr('transform', function (d) {
            return 'rotate(-65)'
          })

        // average line
        chart.svg.selectAll('.line').remove()

        const dataSum = d3.sum(data, function (d) {
          return d.velocity
        })

        const line = d3.line()
          .x(function (d, i) {
            return chart.x2Chart(d.sprintNumber) + i
          })
          .y(function (d, i) {
            return chart.yChart(dataSum / data.length)
          })

        chart.svg.append('path')
          .datum(data)
          .attr('class', 'line')
          .attr('d', line)
      }
    },
    data () {
      return {}
    }
  }
</script>
