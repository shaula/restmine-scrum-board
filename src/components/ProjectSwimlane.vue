<template>
    <div :id="'project' + projectHierarchy.id" class="project">
        <div class="project-name" :title="projectBreadcrumb(projectHierarchy)">{{ projectHierarchy.name }}</div>

        <IssuesColumns :columns="columns" :issues="projectIssues" :hideProject="true" :users="users" />

        <ProjectSwimlane v-for="projectEntry in projectHierarchy.subProjects"
                         :columns="columns"
                         :issues="issues"
                         :projectHierarchy="projectEntry"
                         :projects="projects"
                         :users="users" />
    </div>
</template>

<style scoped>
    .project {
        border: 1px solid lightgray;
        padding: 2px;
        margin: 4px 0;
        border-radius: 4px;
    }

    .project-name {
        text-align: left;
    }
</style>

<script>
  import IssuesColumns from './IssuesColumns'

  export default {
    name: 'ProjectSwimlane',
    props: ['columns', 'issues', 'projects', 'projectHierarchy', 'users'],
    data () {
      return {}
    },
    computed: {
      projectIssues () {
        let issues = []
        for (let index in this.issues) {
          if (this.issues.hasOwnProperty(index)) {
            if (this.issues[index].project.id === this.projectHierarchy.id) {
              issues.push(this.issues[index])
            }
          }
        }
        return issues
      }
    },
    methods: {
      projectBreadcrumb (projectHierarchy) {
        let breadcrumbs = []
        let project = this.projects[projectHierarchy.id]
        if (project) {
          while (project.parent) {
            project = this.projects[project.parent.id]
            breadcrumbs.push(project.name)
          }
        }
        return breadcrumbs.reverse().join(' » ')
      }
    },
    components: {
      IssuesColumns
    }
  }
</script>
