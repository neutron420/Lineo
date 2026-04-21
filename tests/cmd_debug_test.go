package tests

import "testing"

func TestDebugPlaceholder(t *testing.T) {
	if true != true {
		t.Error("Logic failed")
	}
}
