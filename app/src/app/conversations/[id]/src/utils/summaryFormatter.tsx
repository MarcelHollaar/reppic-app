export const summaryFormatter = (summary: string) => {
  return summary
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, '<span class="small-gap"></span>')
    .replace(/\n/g, "<br/>")
    .replace(/#/g, "");
};
