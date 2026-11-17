import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CATEGORIES } from '../constants/categories';

function SortableItem({ id, label, color, emoji, index }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const cat = CATEGORIES.find((c) => c.id === id);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 cursor-grab shadow-sm hover:shadow-md transition-shadow"
    >
      <span className="text-gray-400 font-mono text-sm w-5 text-center select-none">{index + 1}</span>
      <span className="text-xl">{cat?.emoji}</span>
      <span className="flex-1 font-medium text-gray-800">{cat?.label || id}</span>
      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
    </div>
  );
}

export default function CategoryRanker({ priorities, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIdx = priorities.indexOf(active.id);
      const newIdx = priorities.indexOf(over.id);
      onChange(arrayMove(priorities, oldIdx, newIdx));
    }
  }

  if (!priorities.length) return (
    <p className="text-gray-400 text-sm italic">Select categories above to rank them here.</p>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {priorities.map((id, i) => (
            <SortableItem key={id} id={id} index={i} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
