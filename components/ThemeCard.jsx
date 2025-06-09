export default function ThemeCard({ theme, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border text-sm transition-all
        ${selected ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"}
      `}
    >
      {theme}
    </button>
  );
}
