interface HiveTagProps {
  title: string;
  color: string;
}

export const HiveTag = ({ title, color }: { title: string; color: string }) => {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-[14px] h-[5px] rounded-[50px] ${color} rotate-[15deg]`}
      />
      <p className="w-[50px] text-white text-right text-[9px] leading-normal">
        {title}
      </p>
    </div>
  );
};
