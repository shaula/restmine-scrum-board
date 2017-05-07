<template>
    <div class="issue"
         :title="issue.description">
        <div class="issue-group-about">
            <span class="issue-tracker" @click="bus.$emit('issueClick', issue.id)">{{ trackerName }}</span>
            <span class="issue-subject" @click="bus.$emit('issueClick', issue.id)">{{ subject }}</span>
            <span v-if="!hideProject" class="issue-project" :class="'project' + issue.project.id"
                  @click="bus.$emit('projectClick', issue.project.id)">{{ project }}</span>
        </div>

        <slot />

        <div class="issue-group-assignee">
            <img :src="assigneeAvatarUrl" />
            <span>{{ assigneeName }}</span>
        </div>

        <div class="issue-group-status">
            <span class="isusue-status">{{ status }}</span>
            <span class="issue-estimation">{{ estimation }}</span>
            <span class="issue-done-ratio">{{ doneRatio }}</span>
            <span class="issue-developer-hours">{{ developerHours }}</span>
        </div>
    </div>
</template>

<style scoped>
    h1, h2 {
        font-weight: normal;
    }

    ul {
        list-style-type: none;
        padding: 0;
    }

    li {
        display: inline-block;
        margin: 0 10px;
    }

    a {
        color: #42b983;
    }

    .issue {
        border: 1px solid gray;
        position: relative;
        margin: 5px 0;
        padding: 2px;
        border-radius: 4px;
        text-overflow: ellipsis;
        overflow: hidden;
    }

    .issue-group-about {
        text-align: left;
        margin-bottom: 80px;
        hyphens: auto;
    }

    .issue-project {
        margin-top: 4px;
        font-style: italic;
    }

    .issue-group-assignee {
        position: absolute;
        bottom: 0;
        left: 2px;
        text-align: left;
    }

    .issue-group-status {
        position: absolute;
        bottom: 0;
        right: 2px;
        text-align: right;
    }

    .issue span {
        display: block;
    }

    .issue .issue-tracker {
        font-weight: bold;
    }

    .issue .issue-title {
        margin: 5px 0;
    }

    .issue .issue-tracker,
    .issue .issue-subject {
        display: inline;
    }

    .issue .issue-tracker:after {
        content: ": ";
    }

    .issue .issue-tracker {
        font-weight: bold;
    }
</style>

<script>
  const md5 = require('md5')
  import Draggable from 'vuedraggable'

  export default {
    name: 'issue',
    data () {
      return {}
    },
    props: ['assignee', 'author', 'hideProject', 'issue'],
    computed: {
      doneRatio () {
        return (this.issue.done_ratio || '0') + '%'
      },
      project () {
        return this.issue.project.name
      },
      status () {
        return this.issue.status.name
      },
      estimation () {
        if (this.trackerName === 'Bug' || this.trackerName === 'Task') {
          return ''
        }

        const storyPoints = window.getStoryPointsFrom(this.issue)
        if (storyPoints) {
          return storyPoints + 'SP'
        }

        return '?'
      },
      developerHours () {

      },
      subject () {
        return this.issue.subject
      },
      trackerName () {
        return this.issue.tracker.name
      },
      assigneeName () {
        return this.assignee ? this.assignee.login : ''
      },
      assigneeAvatarUrl () {
        let url
        if (!this.assignee) {
          url = '/static/avatar-unassigned.png'
        } else {
          url = 'https://www.gravatar.com/avatar/' + md5(String(this.assignee.mail).toLowerCase()) + '?s=50'
        }
        return url
      }
    },
    components: {
      Draggable
    }
  }
</script>
