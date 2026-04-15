package service

import "testing"

func TestParseRangeToHours(t *testing.T) {
	cases := []struct {
		in   string
		want int
	}{
		{"7d", 168},
		{"30d", 720},
		{"24", 24},
		{"invalid", 168},
	}

	for _, c := range cases {
		got := ParseRangeToHours(c.in)
		if got != c.want {
			t.Fatalf("ParseRangeToHours(%q)=%d want %d", c.in, got, c.want)
		}
	}
}
