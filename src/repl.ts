async function* getTextInput(): string {
  while (true) {
    const input = prompt("Enter text");
    yield input;
  }
}
