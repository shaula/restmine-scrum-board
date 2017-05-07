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
