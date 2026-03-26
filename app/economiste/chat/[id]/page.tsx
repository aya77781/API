import { ChatPage } from '@/components/shared/ChatPage'
export default function Page({ params }: { params: { id: string } }) {
  return <ChatPage roleBase="economiste" groupeId={params.id} />
}
