export const PASTEL_TAG_CLASSES = [
  'bg-[#D6ECFA]/95 text-[#123E66]', // Pastel Sky Blue
  'bg-[#D8F3DC]/95 text-[#1B4332]', // Pastel Mint
  'bg-[#E6DFFF]/95 text-[#35236B]', // Pastel Lavender
  'bg-[#CFF5EE]/95 text-[#0F4C46]', // Pastel Aqua
] as const;

export const SLOGAN_BOX_CLASS =
  'bg-[#FFE4EF]/95 text-[#6F1F3B] font-semibold border-[1.5px] border-white shadow-[0_0_10px_rgba(255,255,255,0.9),0_3px_10px_-3px_rgba(111,31,59,0.12)]';

export function getPastelTagClass(index: number): string {
  return PASTEL_TAG_CLASSES[index % PASTEL_TAG_CLASSES.length];
}
