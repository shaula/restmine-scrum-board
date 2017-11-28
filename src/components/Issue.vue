<template>
    <div class="issue"
         :title="issue.description">
        <div class="issue-group-about">
            <a class="issue-subject" :href="issueUrl">
                <span class="issue-tracker">{{ trackerName }}</span>
                <span class="issue-id">{{ issue.id }}</span>
                {{ subject }}
            </a>
            <a v-if="!hideProject" class="issue-project"
               :class="'project' + issue.project.id"
               :href="projectUrl">{{ project }}</a>
        </div>

        <slot />

        <div class="issue-group-assignee">
            <Avatar :user="assignee" />
        </div>

        <div class="issue-group-status" :title="updatedAtTitle">
            <span v-if="priority != 'Normal'" class="issue-priority" :class="'issue-priority-' + priority.toLowerCase()" title="Priority">{{ priority }}</span>
            <span class="issue-status">{{ status }}</span>
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
        text-decoration: none;
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

    .issue a {
        color: black;
    }

    .issue a:hover {
        color: rgb(66, 139, 202);
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
        max-width: 60%;
    }

    .issue span,
    .issue a {
        display: block;
    }

    .issue .issue-tracker,
    .issue .issue-id {
        font-weight: bold;
    }

    .issue .issue-title {
        margin: 5px 0;
    }

    .issue .issue-tracker,
    .issue .issue-id {
        display: inline;
    }

    .issue .issue-id:before {
        content: " #";
    }

    .issue .issue-id:after {
        content: ": ";
    }

    .issue .issue-tracker {
        font-weight: bold;
    }

    .issue .issue-subject {
        -webkit-hyphens: auto;
        -moz-hyphens: auto;
        hyphens: auto;
    }

    .issue .issue-priority-urgent {
        color: #7a0000;
    }

    .issue .issue-priority-high {
        color: #5a0000;
    }

    .issue .issue-priority-low
    {
        color: #666;
    }

    .issue .issue-priority-lowest
    {
        color: #888;
    }
</style>

<script>
  import Draggable from 'vuedraggable'
  import Avatar from './Avatar'

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
      priority () {
      	return this.issue.priority.name
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
      issueUrl () {
        return this.redmineUrl + '/issues/' + this.issue.id
      },
      projectUrl () {
        return this.redmineUrl + '/projects/' + this.issue.project.id
      },
      updatedAtTitle () {
        return 'updated at ' + (new Date(this.issue.updated_on)).toLocaleString()
      },
    },
    components: {
      Draggable,
      Avatar
    }
  }
</script>
