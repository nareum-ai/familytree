declare module 'solarlunar' {
  interface LunarResult {
    lYear: number; lMonth: number; lDay: number;
    sYear: number; sMonth: number; sDay: number;
    isLeap: boolean;
  }
  const solarlunar: {
    solar2lunar(y: number, m: number, d: number): LunarResult;
    lunar2solar(y: number, m: number, d: number, isLeapMonth: boolean): LunarResult;
  };
  export default solarlunar;
}
