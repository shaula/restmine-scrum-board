<template>
    <IssuesColumns :columns="columns" :issues="sortedIssues" :users="users"/>
</template>

<style scoped>

</style>

<script>
  import IssuesColumns from './IssuesColumns'

  export default {
    name: 'DefaultSwimlane',
    props: ['columns', 'issues', 'projects', 'projectHierarchy', 'users'],
    data () {
      return {
      }
    },
    computed: {
      sortedIssues () {
        let issues = Object.values(this.issues)

        const sortedProjectIds = this.getProjectEntryIds(this.projectHierarchy)

        issues = issues.sort(function (a, b) {
          let aIndex = sortedProjectIds.indexOf(a.project.id)
          let bIndex = sortedProjectIds.indexOf(b.project.id)
          return (aIndex < bIndex) ? -1 : ((aIndex > bIndex) ? 1 : 0)
        })

        return issues
      }
    },
    methods: {
      getProjectEntryIds (projectEntry) {
        let ids = [projectEntry.id]
        for (let index in projectEntry.subProjects) {
          if (projectEntry.subProjects.hasOwnProperty(index)) {
            ids = ids.concat(this.getProjectEntryIds(projectEntry.subProjects[index]))
          }
        }
        return ids
      }
    },
    components: {
      IssuesColumns
    }
  }
</script>
