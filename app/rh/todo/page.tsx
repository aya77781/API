import { TopBar } from '@/components/co/TopBar'
import { TodoList } from '@/components/shared/TodoList'

export default function TodoPage() {
  return (
    <div>
      <TopBar
        title="Ma Todo List"
        subtitle="Gérez vos tâches personnelles et partagées"
      />
      <div className="p-6">
        <TodoList role="rh" />
      </div>
    </div>
  )
}
