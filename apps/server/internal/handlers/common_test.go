package handlers

import "testing"

func TestAttachmentName(t *testing.T) {
	for in, want := range map[string]string{
		"plan.pdf":                "plan.pdf",
		"../../etc/passwd":        "passwd",
		`C:\Users\me\report.docx`: "report.docx",
		"bad\r\nBcc: x@evil.test": "badBcc: x@evil.test",
		"  ":                      "attachment",
		"":                        "attachment",
	} {
		if got := attachmentName(in); got != want {
			t.Errorf("attachmentName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAttachmentType(t *testing.T) {
	if got := attachmentType("application/pdf; name=x.pdf", nil); got != "application/pdf" {
		t.Errorf("sent type: %q", got)
	}
	if got := attachmentType("", []byte("%PDF-1.7")); got != "application/pdf" {
		t.Errorf("sniffed type: %q", got)
	}
	if got := attachmentType("garbage", []byte("hello")); got != "text/plain" {
		t.Errorf("fallback type: %q", got)
	}
}
