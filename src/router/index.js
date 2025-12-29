import { createRouter, createWebHistory } from 'vue-router'
import Home from '../pages/Home.vue'
import Login from '../pages/Login.vue'
import Board from '../pages/Board.vue'
import Profile from '../pages/Profile.vue'
import Stats from '../pages/Stats.vue'
import Contact from '../pages/Contact.vue'
import { supabase } from '../lib/supabase'

const routes = [
  { path: '/', component: Home, meta: { public: true } },
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/contact', component: Contact, meta: { public: true } },
  { path: '/board', component: Board },
  { path: '/profile', component: Profile },
  { path: '/stats', component: Stats }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  if (to.meta.public) return next()
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user ?? null
  if (!user) return next('/login')
  next()
})

export default router