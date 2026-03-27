import { ChatPage } from '@/components/shared/ChatPage'
export default function Page({ params }: { params: { id: string } }) {
  return <ChatPage roleBase="admin" groupeId={params.id} fetchAll />
}
