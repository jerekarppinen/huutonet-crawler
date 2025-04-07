// Helper function to format elapsed time
export default function formatElapsedTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  let result = '';
  
  if (hours > 0) {
    result += `${hours} hour${hours !== 1 ? 's' : ''} `;
  }
  
  if (remainingMinutes > 0 || hours > 0) {
    result += `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} `;
  }
  
  result += `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  
  return result;
}