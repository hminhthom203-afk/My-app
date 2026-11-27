export const PASTEL_TAG_CLASSES = [
  'bg-[#D6ECFA]/95 text-[#123E66]', // Pastel Sky Blue
  'bg-[#D8F3DC]/95 text-[#1B4332]', // Pastel Mint
  'bg-[#E6DFFF]/95 text-[#35236B]', // Pastel Lavender
  'bg-[#CFF5EE]/95 text-[#0F4C46]', // Pastel Aqua
] as const;

export const SLOGAN_BOX_CLASS =
  'bg-[#FFF3C4]/95 text-[#5C4308] border-[1.5px] border-white shadow-[0_0_8px_rgba(255,255,255,0.98),0_0_14px_rgba(255,255,255,0.7),0_2px_6px_rgba(92,67,8,0.12)]';

export function getPastelTagClass(index: number): string {
  return PASTEL_TAG_CLASSES[index % PASTEL_TAG_CLASSES.length];
}
