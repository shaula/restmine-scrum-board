<template>
    <div class="row" v-drag-and-drop:options="options">
        <div v-for="column in columns" class="column" :key="column.abbr" :class="'column-' + column.abbr">
            <Issue v-for="issue in issuesByColumn[column.abbr]" :key="issue.id"
                   :hideProject="hideProject"
                   :assignee="assigneeOf(issue)"
                   :author="authorOf(issue)"
                   :issue="issue" />
        </div>
    </div>
</template>

<style scoped>
    /* drop target state */
    .column[aria-dropeffect="move"] {
        border-color: #68b;
        background: #dff9ef;
    }

    /* drop target focus and dragover state */
    .column[aria-dropeffect="move"]:focus,
    .column[aria-dropeffect="move"].dragover {
        outline: none;
        box-shadow: 0 0 0 1px #fff, 0 0 0 3px #68b;
    }

    /* items focus state */
    .issue:focus {
        outline: none;

        box-shadow: 0 0 0 2px #68b, inset 0 0 0 1px #ddd;
    }

    /* items grabbed state */
    .issue[aria-grabbed="true"] {
        border-style: dotted;
    }


</style>

<script>
  import Issue from './Issue'

  export default {
    name: 'IssuesColumns',
    props: ['columns', 'hideProject', 'issues', 'users'],
    data () {
      return {}
    },
    computed: {
      options () {
        return {
          dropzoneSelector: '.columnDisabled',
          draggableSelector: '.issueDisabled',
          excludeOlderBrowsers: true,
          multipleDropzonesItemsDraggingEnabled: true,
          onDrop: this.onDrop
        }
      },
      issuesByColumn () {
        let issues = {}

        for (let abbr in this.columns) {
          if (this.columns.hasOwnProperty(abbr)) {
            for (let index in this.issues) {
              if (this.issues.hasOwnProperty(index)) {
                let issue = this.issues[index]

                if (this.columns[abbr].statuses.indexOf(issue.status.name) > -1) {
                  issues[abbr] = issues[abbr] || []
                  issues[abbr].push(issue)
                }
              }
            }
          }
        }

        return issues
      }
    },
    methods: {
      authorOf (issue) {
        const id = issue.author ? issue.author.id : false
        return (id && this.users[id]) ? this.users[id] : null
      },
      assigneeOf (issue) {
        const id = issue.assigned_to ? issue.assigned_to.id : false
        return (id && this.users[id]) ? this.users[id] : null
      },
      userById (id) {
        return this.users[id]
      },
      onMove ({relatedContext, draggedContext}) {
        const relatedElement = relatedContext.element
        const draggedElement = draggedContext.element
        return (!relatedElement || !relatedElement.fixed) && !draggedElement.fixed
      },
      onDrop (evt) {
        console.log('drop')
        debugger
      }
    },
    components: {
      Issue
    }
  }
</script>
