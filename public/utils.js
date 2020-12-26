export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const getId = () => Math.random().toString(36).slice(2);
export const delay = async (t, cb) => setTimeout(cb, t);
