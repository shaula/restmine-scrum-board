export function estimationFrom (issues) {
  let estimation = 0
  let index
  for (index in issues) {
    if (issues.hasOwnProperty(index)) {
      estimation += window.getStoryPointsFrom(issues[index])
    }
  }

  if (estimation === 0) {
    return ''
  } else {
    return estimation
  }
}

export function leftFrom (issues) {
  let hasStoryPoints = false
  let leftCalculation = 0
  let index
  for (index in issues) {
    if (issues.hasOwnProperty(index)) {
      let estimation = window.getStoryPointsFrom(issues[index])
      if (estimation) {
        hasStoryPoints = true
        let done = estimation * (issues[index].done_ratio || 0) / 100
        leftCalculation += estimation - done
      }
    }
  }

  if (hasStoryPoints) {
    // be pessimistic: round up
    return Math.ceil(leftCalculation)
  }
  return ''
}

export function leftOfEstimationFrom (issues) {
  let estimation = estimationFrom(issues)
  if (estimation !== '') {
    return '<span title="remaining estimation">' + leftFrom(issues) + '</span><span title="total estimation">/' + estimation + '</span>'
  }
  return ''
}

export function doneRatioFrom (issues) {
  let totalEstimatedPoints = 0
  let totalDonePoints = 0

  let index
  for (index in issues) {
    if (issues.hasOwnProperty(index)) {
      let doneRatio = (issues[index].done_ratio || 0)
      let estimatedPoints = window.getStoryPointsFrom(issues[index])

      if (!estimatedPoints) {
        // tracker got no Story Points - use invested time as SP
        estimatedPoints = doneRatio > 0
          ? 100 * (issues[index].spent_hours || 0) / doneRatio
          : 0
      }

      totalDonePoints += estimatedPoints * doneRatio / 100
      totalEstimatedPoints += estimatedPoints
    }
  }

  // be pessimistic: round down
  return totalEstimatedPoints > 0
    ? Math.floor(totalDonePoints * 100 / totalEstimatedPoints)
    : 0
}