import { NotesFraisPage } from '@/components/shared/NotesFraisPage'
import { NotesFraisValidation } from '@/components/shared/NotesFraisValidation'

export default function Page() {
  return (
    <div>
      <NotesFraisPage />
      <div className="px-6 pb-10">
        <div className="border-t border-gray-200 pt-8 mt-2">
          <NotesFraisValidation embedded />
        </div>
      </div>
    </div>
  )
}
