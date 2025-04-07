// Function to add random delay to mimic human behavior
export default async function randomDelay(min: number, max: number, message: string = 'delay'): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log('---')
    console.log('min', min)
    console.log('max', max)
    console.log(`${message} ${delay}`)
    console.log('---')
    return new Promise(resolve => setTimeout(resolve, delay));
}