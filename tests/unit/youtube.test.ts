import { describe, it, expect } from "vitest";
import { YOUTUBE_LINK_ERROR, YOUTUBE_LINK_MAX, parseYoutubeLink, youtubeLink } from "@/lib/youtube";

const MA = "5qap5aO4i9A";
const SAI = { ok: false, error: YOUTUBE_LINK_ERROR };

describe("parseYoutubeLink", () => {
  it("chuoi rong hoac chi khoang trang la khong co nhac", () => {
    expect(parseYoutubeLink("")).toEqual({ ok: true, id: null });
    expect(parseYoutubeLink("   ")).toEqual({ ok: true, id: null });
  });

  it.each([
    [`https://www.youtube.com/watch?v=${MA}`],
    [`https://youtube.com/watch?v=${MA}`],
    [`https://m.youtube.com/watch?v=${MA}`],
    [`https://music.youtube.com/watch?v=${MA}&list=RDAMVM${MA}`],
    [`http://www.youtube.com/watch?v=${MA}`],
    [`https://www.youtube.com/watch?feature=share&v=${MA}&t=42`],
    [`https://www.youtube.com/shorts/${MA}`],
    [`https://www.youtube.com/embed/${MA}?start=10`],
    [`https://www.youtube.com/live/${MA}?si=abc`],
    [`https://www.youtube-nocookie.com/embed/${MA}`],
    [`https://youtube-nocookie.com/embed/${MA}`],
    [`https://youtu.be/${MA}`],
    [`https://youtu.be/${MA}?si=XyZ&t=5`],
    [`https://youtu.be/${MA}#t=5`],
    [`HTTPS://WWW.YOUTUBE.COM/watch?v=${MA}`],
    [`  https://youtu.be/${MA}  `],
  ])("nhan %s", (link) => {
    expect(parseYoutubeLink(link)).toEqual({ ok: true, id: MA });
  });

  it.each([
    ["host gia dang duoi", `https://youtube.com.evil.test/watch?v=${MA}`],
    ["host chi chua chu youtube", `https://notyoutube.com/watch?v=${MA}`],
    ["host con la", `https://evil.youtube.com/watch?v=${MA}`],
    ["host co dau cham cuoi", `https://youtube.com./watch?v=${MA}`],
    ["ten dang nhap truoc host that", `https://youtube.com@evil.test/watch?v=${MA}`],
    ["ten dang nhap truoc host youtube", `https://ai@youtube.com/watch?v=${MA}`],
    ["co cong", `https://youtube.com:8443/watch?v=${MA}`],
    ["youtu.be khong dung watch", `https://youtu.be/watch?v=${MA}`],
    ["scheme javascript", `javascript:alert("${MA}")`],
    ["scheme javascript mang host youtube", `javascript://youtube.com/%0Aalert(1)//watch?v=${MA}`],
    ["scheme ftp", `ftp://youtube.com/watch?v=${MA}`],
    ["scheme data", `data:text/html,${MA}`],
    ["thieu scheme", `youtu.be/${MA}`],
    ["thieu scheme co hai gach", `//youtu.be/${MA}`],
    ["ma tran", MA],
    ["ma ngan 10 ky tu", `https://youtu.be/${MA.slice(0, 10)}`],
    ["ma dai 12 ky tu", `https://youtu.be/${MA}x`],
    ["ma co ky tu la", `https://youtu.be/${MA.slice(0, 10)}.`],
    ["ma ma hoa phan tram", `https://youtu.be/%35qap5aO4i9A`],
    ["youtu.be them doan duong dan", `https://youtu.be/${MA}/them`],
    ["youtu.be co gach cuoi", `https://youtu.be/${MA}/`],
    ["shorts them doan duong dan", `https://www.youtube.com/shorts/${MA}/them`],
    ["embed thieu ma", "https://www.youtube.com/embed/"],
    ["duong dan la", `https://www.youtube.com/v/${MA}`],
    ["kenh", "https://youtube.com/@linh"],
    ["watch thieu v", "https://www.youtube.com/watch?list=abc"],
    ["watch hai tham so v", `https://www.youtube.com/watch?v=${MA}&v=${MA}`],
    ["watch co doan duong dan truoc", `https://www.youtube.com/a/watch?v=${MA}`],
    ["chu thuong", "nhac cua em"],
  ])("tu choi %s", (_ten, link) => {
    expect(parseYoutubeLink(link)).toEqual(SAI);
  });

  it("link dung tran 300 ky tu thi nhan, qua tran thi tu choi, dem sau khi cat khoang trang", () => {
    const dau = `https://youtu.be/${MA}?si=`;
    const dungTran = dau + "a".repeat(YOUTUBE_LINK_MAX - dau.length);
    expect(dungTran).toHaveLength(YOUTUBE_LINK_MAX);
    expect(parseYoutubeLink(dungTran)).toEqual({ ok: true, id: MA });
    expect(parseYoutubeLink(` ${dungTran} `)).toEqual({ ok: true, id: MA });
    expect(parseYoutubeLink(`${dungTran}a`)).toEqual(SAI);
  });

  it("link ngan dung de dien lai form doc lai ra dung ma", () => {
    expect(youtubeLink(MA)).toBe(`https://youtu.be/${MA}`);
    expect(parseYoutubeLink(youtubeLink(MA))).toEqual({ ok: true, id: MA });
  });
});
