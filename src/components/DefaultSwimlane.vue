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

        /* sort project-wise *
        const sortedProjectIds = this.getProjectEntryIds(this.projectHierarchy)

        issues = issues.sort(function (a, b) {
          let aIndex = sortedProjectIds.indexOf(a.project.id)
          let bIndex = sortedProjectIds.indexOf(b.project.id)
          return (aIndex < bIndex) ? -1 : ((aIndex > bIndex) ? 1 : 0)
        })
        /**/

        /* sort by updated_on DESC */
        issues = issues.sort(function (a, b) {
          let aUpdatedOn = new Date(a.updated_on)
          let bUpdatedOn =  new Date(b.updated_on)

          return (aUpdatedOn < bUpdatedOn) ? 1 : ((aUpdatedOn > bUpdatedOn) ? -1 : 0)
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
