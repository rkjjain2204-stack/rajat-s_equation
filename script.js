const form = document.getElementById('equation-form');
const aInput = document.getElementById('a');
const bInput = document.getElementById('b');
const cInput = document.getElementById('c');
const equationText = document.getElementById('equation-text');
const answerText = document.getElementById('answer-text');

function formatEquation(a, b, c) {
  const bSign = b >= 0 ? '+' : '-';
  return `${a}x ${bSign} ${Math.abs(b)} = ${c}`;
}

function solveLinearEquation(a, b, c) {
  if (a === 0) {
    return 'No unique solution (a cannot be 0).';
  }

  const x = (c - b) / a;
  return Number.isInteger(x) ? `x = ${x}` : `x = ${x.toFixed(2)}`;
}

function renderResult() {
  const a = Number(aInput.value);
  const b = Number(bInput.value);
  const c = Number(cInput.value);

  equationText.textContent = formatEquation(a, b, c);
  answerText.textContent = solveLinearEquation(a, b, c);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderResult();
});

renderResult();
