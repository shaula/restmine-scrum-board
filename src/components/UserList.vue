<template>
    <div class="userList" :class="{hasInactive: inactiveUserIds.length > 0}">
        <h3 class="headline">{{ headline }}</h3>

        <div>
            <span class="link" @click="selectAll">all</span>
            /
            <span class="link" @click="selectNone">none</span>
        </div>

        <ul>
            <li class="user"
                v-for="user in sortedUsers" :key="user.id"
                :class="{inactive: inactiveUserIds.indexOf(user.id) !== -1}"
                @click="bus.$emit('toggleUserSelection', user.id)">
                <Avatar :user="user" />
            </li>
        </ul>
    </div>
</template>

<style scoped>
    .userList ul,
    .userList li {
        list-style: none;
        padding-left: 0;
        margin: 0;
    }

    .userList .user {
        border: 1px solid darkgray;
        border-radius: 4px;
        width: 80px;
        text-align: center;
        cursor: pointer;
        margin: 8px;
    }

    .user div {
        margin: 4px auto 0;
    }
    .user.inactive {
        opacity: 0.4;
    }

    .user .avatar {
        width: 100%;
    }

    .link {
        cursor: pointer;
    }
</style>

<script>
  import { estimationFrom } from '../helpers'
  import Avatar from './Avatar'

  export default {
    name: 'UserList',
    props: ['headline', 'users', 'userDisplaySetting', 'inactiveUserIds'],
    computed: {
      sortedUsers () {
        const sortedUsers = [];
        for (let id in this.users) {
          if (this.users.hasOwnProperty(id)) {
            sortedUsers.push(this.users[id])
          }
        }
        return sortedUsers.sort(function (userA, userB) {
          return userA.displayName > userB.displayName
        });
      }
    },
    methods: {
      selectAll () {
        const inactiveUserIds = [];
        for (let index in this.inactiveUserIds) {
          if (this.inactiveUserIds.hasOwnProperty(index)) {
            inactiveUserIds.push(this.inactiveUserIds[index]);
          }
        }
        this.bus.$emit('toggleUserSelection', inactiveUserIds);
      },
      selectNone () {
        const activeUserIds = [];
        const inactiveUserIds = this.inactiveUserIds;
        for (let id in this.users) {
          if (this.users.hasOwnProperty(id)) {
            const numericId = parseInt(id);
            if (this.users.hasOwnProperty(id) && inactiveUserIds.indexOf(numericId) === -1) {
              activeUserIds.push(numericId);
            }
          }
        }
        this.bus.$emit('toggleUserSelection', activeUserIds);
      }
    },
    data () {
      return {}
    },
    components: {
      Avatar
    }
  }
</script>
