export const clientXY = (event: MouseEvent | TouchEvent | React.MouseEvent) => {
  if ((event as TouchEvent).touches) {
    const touch = (event as TouchEvent).touches[0];
    return { x: touch.pageX, y: touch.pageY };
  } else
    return {
      x: (event as MouseEvent).clientX,
      y: (event as MouseEvent).clientY,
    };
};
