// শতাংশ পরিবর্তন হিসাবের সহায়ক ফাংশন
function calculatePercentageChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? "100.00" : "0.00";
  }
  const change = ((current - previous) / previous) * 100;
  return change.toFixed(2);
}


export default calculatePercentageChange