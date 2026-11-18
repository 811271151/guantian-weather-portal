import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "./MarkdownContent";

describe("Model answer rendering", () => {
  it("renders weather tables, emphasis, lists and code as semantic elements", () => {
    const content =
      '**南京明天**\n\n| 日期 | 降水概率 |\n| --- | --- |\n| 明天 | 18% |\n\n- 建议带伞\n\n```python\nprint("weather")\n```';
    const html = renderToStaticMarkup(<MarkdownContent content={content} />);
    expect(html).toContain("<strong>南京明天</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>降水概率</th>");
    expect(html).toContain("<td>18%</td>");
    expect(html).toContain("<li>建议带伞</li>");
    expect(html).toContain("<pre");
    expect(html).not.toContain("**南京明天**");
  });

  it("does not execute model-supplied HTML or unsafe links", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        content={
          "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[危险链接](javascript:alert%281%29)"
        }
      />,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain('href="javascript:');
  });
});
