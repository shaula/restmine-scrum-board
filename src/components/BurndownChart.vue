<template>
  <div>
    <div class="formCtr">
      <label>
        Sprint start
        <input :value="formattedStartDate" type="text" id="startDate" @change="onConfigChange"/>
      </label>
      <label title="including weekend">
        Sprint duration
        <input :value="durationInDays" type="number" id="durationInDays" @change="onConfigChange"/>
      </label>
    </div>

    <div v-show="!isReady" class="loadingCtr">
      <em>Please be patient, loading burndown may take a while!</em>
      <span v-show="!isReady" class="icon icon-loader"></span>
    </div>
    <div v-show="isReady">
      <svg id="burndownChart" class="chart" width="800" height="400"></svg>
      <p>
        <em>You may zoom in by selecting an area. Using a double-click resets the zoom.</em>
      </p>
    </div>
  </div>
</template>

<style>
  .loadingCtr,
  .formCtr {
    margin: 10px;
  }

  .chart {
    border: 1px solid black;
  }
  .chart div {
    font: 10px sans-serif;
    background-color: steelblue;
    text-align: right;
    padding: 3px;
    margin: 1px;
    color: white;
  }
  .axis path,
  .axis line {
    fill: none;
    stroke: #000;
    shape-rendering: crispEdges;
  }
  .line {
    fill: none;
    stroke-width: 1.5px;
  }
  .line.ideal {
    stroke: steelblue;
  }
  .line.actual {
    stroke: orange;
  }

  .grid line {
    stroke: #ddd;
  }

  rect.weekend {
    fill: #ddd;
  }

  circle {
    fill: #666;
  }

  div.tooltip {
    position: absolute;
    text-align: left;
    min-width: 200px;
    max-width: 400px;
    padding: 2px;
    font: 12px sans-serif;
    background: lightsteelblue;
    border: 0;
    border-radius: 8px;
    pointer-events: none;
  }

  .tooltip ul {
    padding-left: 20px;
    font-size: 120%;
  }
</style>

<script>
  require('pikaday-time/css/pikaday.css')

  const d3 = require('d3')
  import Vue from 'vue'
  import Pikaday from 'pikaday-time'

  function padZero(value) {
    if (value < 10) {
      return '0' + String(value)
    } else {
      return String(value)
    }
  }

  function formatDate(date) {
    if (!date) {
      return ''
    }

    const hours = padZero(date.getHours())
    const minutes = padZero(date.getMinutes())

    const month = padZero(date.getMonth() + 1)
    const day = padZero(date.getDate())

    return date.getFullYear() + '-' + month + "-" + day + " " + hours + ":" + minutes
  }

  function interpolate(scale, x, data) {
    const left = d3.bisector(d => d.date).left

    const j = left(data, x, 1)
    const i = j - 1

    const y1 = data[i].points
    const y2 = data[j].points

    const x1 = data[i].date
    const x2 = data[j].date

    // http://www.peter-junglas.de/fh/vorlesungen/thermodynamik1/html/app-a.html
    const t = y1 + ((y2 - y1) / (x2 - x1)) * (x - x1)

    return t
  }

  function interpolateValues(values, point) {
    var i = bisect.left(values, point, 0, values.length - 1),
      a = values[i];
    if (i > 0) {
      var b = values[i - 1],
        t = (point - a[0]) / (b[0] - a[0]);
      return a[1] * (1 - t) + b[1] * t;
    }
    return a[1];
  }

  function getNextWeekendRange (d) {
    const begin = new Date(d);

    let dayOffset = 0;
    if (begin.getDay() >= 6) {
      // already on the weekend, choose next
      dayOffset = 7;
    }

    begin.setDate(begin.getDate() - begin.getDay() + 6 + dayOffset);
    begin.setHours(0);
    begin.setMinutes(0);
    begin.setSeconds(0);

    const end = new Date(begin);
    end.setDate(end.getDate() - end.getDay() + 7);
    end.setHours(23);
    end.setMinutes(59);
    end.setSeconds(59);

    return [begin, end];
  }

  export default {
    name: 'BurndownChart',
    props: ['pointsByTime', 'startDate', 'durationInDays'],
    computed: {
      formattedStartDate () {
        return formatDate(this.startDate)
      },
      endDate ()  {
        if (this.startDate) {
          const endDate = new Date(this.startDate)
          endDate.setDate(endDate.getDate() + parseInt(this.durationInDays))
          return endDate
        }
        return null
      },
      isReady () {
        if (!this.pointsByTime || this.pointsByTime.length === 0) {
          return false
        }

        // re-draw on data change
        Vue.nextTick(function () {
          this.init()
        }.bind(this))

        return true
      },
      chartData () {
        let pointsByTime = this.pointsByTime
        const data = []
        for (let time in pointsByTime) {
          if (pointsByTime.hasOwnProperty(time)) {
            const date = new Date()
            date.setTime(time)

            data.push({
              date: date,
              points: pointsByTime[time].points,
              tooltip: pointsByTime[time].content
            })
          }
        }
        return data
      }
    },
    watch: {
      pointsByTime () {
        // re-draw on data change
        this.init()
      },
      startDate () {
        this.updateChart()
      },
      durationInDays () {
        this.updateChart()
      },
    },
    methods: {
      init () {
        if (!this.chartData.length) {
          return;
        }

        if (!this.chartMembers) {
          this.chartMembers = this.initChart()

          new Pikaday({
            field: document.getElementById('startDate'),
            format: 'YYYY-MM-DD HH:mm',
            incrementMinuteBy: 15,
            use24hour: true,
            onSelect: function () {
              this.onConfigChange()
            }.bind(this)
          })
        }
        this.updateChart(this.chartMembers)
      },
      initChart () {
        let chart = d3.select('#burndownChart')

        const margin = {top: 20, right: 20, bottom: 50, left: 40}
        const width = chart.attr('width') - margin.left - margin.right
        const height = chart.attr('height') - margin.top - margin.bottom

        const x0 = [0, width]
        const y0 = [height, 0]

        const x = d3.scaleTime().range(x0)
        const y = d3.scaleLinear().range(y0)

        const xAxis = d3.axisBottom().scale(x).ticks(12)
        const yAxis = d3.axisLeft().scale(y).ticks(12)

        chart = chart
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        // Create the x-axis
        chart.append("g")
          .attr("class", "axis axis-x")
          .attr("transform", "translate(0," + height + ")")
          .call(xAxis)
          .selectAll("text")
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em")

        // Create the y-axis
        chart.append("g")
          .attr("class", "axis axis-y")
          .call(yAxis)
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", ".71em")
          .style("text-anchor", "end")
          .text("Points")

        // Define the div for the tooltip
        let tooltip = d3.select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("opacity", 0)

        // brush functionality (https://bl.ocks.org/mbostock/f48fcdb929a620ed97877e4678ab15e6)
        const brush = d3.brush().on("end", onBrushEnd)
        chart.append("g")
          .attr("class", "brush")
          .call(brush)

        let idleTimeout
        const idleDelay = 350

        let updateChart = this.updateChart
        function onBrushEnd() {
          const s = d3.event.selection
          if (!s) {
            if (!idleTimeout) {
              return idleTimeout = setTimeout(onIdle, idleDelay)
            }
            updateChart()
          } else {
            x.domain([s[0][0], s[1][0]].map(x.invert, x))
            y.domain([s[1][1], s[0][1]].map(y.invert, y))
            chart.select(".brush").call(brush.move, null)
          }
          zoom()
        }

        function onIdle() {
          idleTimeout = null
        }

        let updateGridLines = this.updateGridLines
        let updateWeekends = this.updateWeekends
        function zoom() {
          const t = chart.transition().duration(750)
          chart.select(".axis-x").transition(t).call(xAxis)
          chart.select(".axis-y").transition(t).call(yAxis)

          chart.selectAll("circle").transition(t)
            .attr("cx", function(d) { return x(d.date) })
            .attr("cy", function(d) { return y(d.points) })

          const actualLine = d3.line()
            .x(function (d) { return x(d.date) })
            .y(function (d) { return y(d.points) })
          chart.selectAll('.line').transition(t)
            .attr("d", actualLine)

          updateGridLines(chart, width, y)
          updateWeekends(chart, width, x)
        }

        return {
          x: x,
          y: y,
          tooltip: tooltip,
          xAxis: xAxis,
          yAxis: yAxis,
          chart: chart,
          width: width,
        }
      },
      updateChart () {
        if (!this.chartMembers) {
          // not initialized yet
          return
        }

        const chartMembers = this.chartMembers
        const dates = this.chartData.map(function (a) { return a.date })

        const start = this.startDate ? this.startDate : new Date(Math.min.apply(null, dates))
        const end = this.endDate ? this.endDate : new Date(Math.max.apply(null, dates))

        const maxPoints = Math.max.apply(null, this.chartData.map(function (a) { return a.points }))

        const actualLine = d3.line()
          .x(function (d) { return chartMembers.x(d.date) })
          .y(function (d) { return chartMembers.y(d.points) })

        chartMembers.x.domain([start, end])

        chartMembers.y.domain([0, Math.ceil(maxPoints / 10) * 10]) // round to next 10

        // update y axis
        chartMembers.chart
          .select('.axis-y')
          .call(chartMembers.yAxis)

        // update x axis
        chartMembers.chart
          .select('.axis-x')
          .call(chartMembers.xAxis)
          .selectAll("text")
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em")

        this.updateGridLines(chartMembers.chart, chartMembers.width, chartMembers.y)
        this.updateWeekends(chartMembers.chart, chartMembers.width, chartMembers.x)

        // Paint the actual line
        chartMembers.chart
          .selectAll('.actual')
          .remove()

        chartMembers.chart
          .append("path")
          .datum(this.chartData)
          .attr("class", "line actual")
          .attr("d", actualLine)

        this.drawIdealLine(chartMembers.chart, chartMembers.x, chartMembers.y)

        // Add the scatterplot
        chartMembers.chart
          .selectAll('circle')
          .remove()

        chartMembers.chart
          .selectAll("dot")
          .data(this.chartData)
          .enter().append("circle")
          .attr("r", 2)
          .attr("cx", function (d) { return chartMembers.x(d.date) })
          .attr("cy", function (d) { return chartMembers.y(d.points) })
          .on("mouseover", function (d) {
            chartMembers.tooltip.transition()
              .duration(200)
              .style("opacity", .9)
            chartMembers.tooltip.html(d.tooltip)
              .style("left", (d3.event.pageX) + "px")
              .style("top", (d3.event.pageY - 28) + "px")
          })
          .on("mouseout", function () {
            chartMembers.tooltip.transition()
              .duration(500)
              .style("opacity", 0)
          })
      },
      updateGridLines (chart, width, y) {
        const gridLines = d3.axisLeft()
          .tickFormat("")
          .tickSize(-width)
          .scale(y)

        chart
          .select('.grid')
          .remove()

        chart
          .append("g")
          .attr("class", "grid")
          .call(gridLines)
      },
      updateWeekends (chart, width, x) {
        // remove rect
        chart.selectAll(".weekend").remove()

        d3.axisTop()
          .scale(x)
          .tickFormat(function (d) {
            if (d.getDay() === 6 || d.getDay() === 0) {
              let leftDate = new Date(d.valueOf())
              leftDate.setHours(0)
              leftDate.setMinutes(0)
              leftDate.setSeconds(0)
              leftDate.setMilliseconds(0)

              let rightDate = new Date(leftDate.valueOf())
              rightDate.setDate(leftDate.getDate() + 1)  //one more day

              const left = x(leftDate)
              const right = x(rightDate)

              if (left !== 0) {
                chart.append("rect")
                  .attr('class', 'weekend')
                  .attr("x", left)
                  .attr("width", right - left)
                  .attr("height", height)
              }
            }
            return ''
          })
          .tickSize(12)
      },
      onConfigChange () {
        const data = {
          sprintStartDate:  new Date(document.getElementById('startDate').value),
          sprintDurationInDays: document.getElementById('durationInDays').value
        }

        this.bus.$emit('burndownChange', data)
      },
      drawIdealLine (chart, x, y) {
        if (!this.startDate) {
          // skip drawing as we don't know where to start
          return
        }

        // retrieve points at given start point
        let points = interpolate(y, this.startDate, this.chartData)

        const data = []
        data.push({
          date: this.startDate,
          points: points,
        })

        // calculate slope (how many SP per working day)
        let workingDays = this.durationInDays
        const weekendRanges = []

        let currentDate = this.startDate
        while (true) {
          const range = getNextWeekendRange(currentDate)
          if (range[0] > this.endDate) {
            break;
          }
          weekendRanges.push(range)
          workingDays -= 2

          currentDate = range[1]
        }
        const slope = points / workingDays

        // loop through weekends and make them constant
        for (let index in weekendRanges) {
          if (weekendRanges.hasOwnProperty(index)) {
            const range = weekendRanges[index]

            const workingDaysDelta = (range[0].getTime() - data[data.length - 1].date) / (86400*1000)
            points = points - slope * workingDaysDelta

            data.push({
              date: range[0],
              points: points,
            });
            data.push({
              date: range[1],
              points: points,
            });
          }
        }

        // at the end we just make it zero
        data.push({
          date: this.endDate,
          points: 0,
        })

        // draw the line
        const idealLine = d3.line()
          .x(function (d) { return x(d.date) })
          .y(function (d) { return y(d.points) })

        chart
          .selectAll('.ideal')
          .remove()
        chart.append('path')
          .data([data])
          .attr('class', 'line ideal')
          .attr('d', idealLine)
      }
    },
    data () {
      return {

      }
    }
  }
</script>
