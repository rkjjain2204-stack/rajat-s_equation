const form = document.getElementById('equation-form');
const resetButton = document.getElementById('reset-button');
const aInput = document.getElementById('a');
const bInput = document.getElementById('b');
const cInput = document.getElementById('c');
const equationText = document.getElementById('equation-text');
const answerText = document.getElementById('answer-text');
const stepsList = document.getElementById('steps');

const defaults = { a: 2, b: 4, c: 10 };

function toNumber(value) {
  return Number(value);
}

function formatEquation(a, b, c) {
  const bSign = b >= 0 ? '+' : '-';
  return `${a}x ${bSign} ${Math.abs(b)} = ${c}`;
}

function solveLinearEquation(a, b, c) {
  if (a === 0 && b === c) {
    return {
      answer: 'Infinitely many solutions',
      steps: ['0x + b = c becomes b = c.', 'Because b and c are equal, every x works.'],
    };
  }

  if (a === 0) {
    return {
      answer: 'No solution',
      steps: ['0x + b = c becomes b = c.', 'Because b and c are different, no x can satisfy the equation.'],
    };
  }

  const rhs = c - b;
  const x = rhs / a;
  const displayX = Number.isInteger(x) ? `${x}` : `${x.toFixed(2)}`;

  return {
    answer: `x = ${displayX}`,
    steps: [`Subtract b from both sides: ${a}x = ${rhs}.`, `Divide both sides by ${a}: x = ${displayX}.`],
  };
}

function renderSteps(steps) {
  stepsList.innerHTML = '';
  steps.forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsList.appendChild(li);
  });
}

function getValues() {
  return {
    a: toNumber(aInput.value),
    b: toNumber(bInput.value),
    c: toNumber(cInput.value),
  };
}

function renderResult() {
  const { a, b, c } = getValues();
  equationText.textContent = formatEquation(a, b, c);
  const { answer, steps } = solveLinearEquation(a, b, c);
  answerText.textContent = answer;
  renderSteps(steps);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderResult();
});

[aInput, bInput, cInput].forEach((input) => {
  input.addEventListener('input', renderResult);
});

resetButton.addEventListener('click', () => {
  aInput.value = defaults.a;
  bInput.value = defaults.b;
  cInput.value = defaults.c;
  renderResult();
});

renderResult();
