package ticket

import "testing"

func TestValidateTransition_Valid(t *testing.T) {
	tests := []struct {
		from State
		to   State
	}{
		{StatePending, StateWaiting},
		{StateWaiting, StateCalled},
		{StateCalled, StateServing},
		{StateServing, StateCompleted},
		{StateServing, StateNoShow},
	}

	for _, tt := range tests {
		if err := ValidateTransition(tt.from, tt.to); err != nil {
			t.Fatalf("expected transition %s->%s to be valid, got error: %v", tt.from, tt.to, err)
		}
	}
}

func TestValidateTransition_Invalid(t *testing.T) {
	if err := ValidateTransition(StatePending, StateServing); err == nil {
		t.Fatal("expected invalid transition error, got nil")
	}
}

func TestRoutingKeyForState(t *testing.T) {
	if got := RoutingKeyForState(StateNoShow); got != "queue.ticket.noshow" {
		t.Fatalf("unexpected routing key: %s", got)
	}
}
