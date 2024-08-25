function numberToWords(number) {
    if (isNaN(number) || number < 0) return 'Invalid number';

    const units = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion'];

    function convertToWords(num) {
        if (num === 0) return 'zero';

        let words = '';
        if (Math.floor(num / 1000) > 0) {
            words += convertToWords(Math.floor(num / 1000)) + ' thousand ';
            num %= 1000;
        }
        if (Math.floor(num / 100) > 0) {
            words += units[Math.floor(num / 100)] + ' hundred ';
            num %= 100;
        }
        if (num > 10 && num < 20) {
            words += teens[num - 11] + ' ';
            num = 0;
        }
        if (num >= 20) {
            words += tens[Math.floor(num / 10) - 1] + ' ';
            num %= 10;
        }
        if (num > 0) {
            words += units[num] + ' ';
        }

        return words.trim();
    }

    return convertToWords(number) + ' rupees';
}

module.exports = {numberToWords};