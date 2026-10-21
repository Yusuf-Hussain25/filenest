import { FolderPlusIcon, PlusIcon, UploadIcon } from 'lucide-react'
import Menu from '../ui/Menu'
import { useActions } from '../../context/ActionsContext'
import { useWorkspace } from '../../context/WorkspaceContext'

// "New" button: upload files or create a folder in the folder you're in.
// variant "fab" is the round floating button on phones.
const NewMenu = ({ variant = 'button', align = 'start' }) => {
  const { here, pickFiles } = useWorkspace();
  const actions = useActions();
  const items = [
    { label: 'Upload files', icon: UploadIcon, onClick: pickFiles, hint: here.id ? `to ${here.name}` : undefined },
    { label: 'New folder', icon: FolderPlusIcon, onClick: () => actions.newFolder(here.id, here.name) },
  ];
  return (
    <Menu items={items} align={align} label="Create">
      {(props) => variant === 'fab' ? (
        <button
          {...props}
          type="button"
          className="grid size-14 place-items-center rounded-2xl text-white shadow-deep transition-transform active:scale-95"
          style={{ background: 'var(--accent-grad)' }}
          aria-label="Upload or create"
        >
          <PlusIcon size={24} />
        </button>
      ) : (
        <button {...props} type="button" className="btn btn-primary btn-block">
          <PlusIcon size={18} /> New
        </button>
      )}
    </Menu>
  );
};

export default NewMenu
