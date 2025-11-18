"use client";

interface IndicatorInfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export default function IndicatorInfoModal({
  open,
  onClose,
  title,
  description,
}: IndicatorInfoModalProps) {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-neutral-black mb-3">
          {title}
        </h2>

        <p className="text-neutral-black/70 leading-relaxed">
          {description}
        </p>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-primary-green hover:bg-green-600 text-white py-2 rounded-lg transition"
        >
          Close
        </button>
      </div>

      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
