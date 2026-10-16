import { Link } from 'react-router'
import { useGoBack } from '../useGoBack'

// "‹ Back": to the screen you came from, or to `parent` if this screen was opened directly
export default function BackLink({ parent }: { parent: string }) {
  const goBack = useGoBack()
  return (
    <Link
      className="back-link"
      to={parent}
      onClick={(e) => {
        e.preventDefault()
        goBack(parent)
      }}
    >
      ‹ Back
    </Link>
  )
}
