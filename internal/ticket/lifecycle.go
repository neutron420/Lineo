package ticket

import (
	"fmt"
)

type State string

const (
	StatePending   State = "pending"
	StateWaiting   State = "waiting"
	StateCalled    State = "called"
	StateServing   State = "serving"
	StateCompleted State = "completed"
	StateNoShow    State = "noshow"
)

var validTransitions = map[State]map[State]struct{}{
	StatePending: {
		StateWaiting: {},
	},
	StateWaiting: {
		StateCalled: {},
		StateNoShow: {},
	},
	StateCalled: {
		StateServing: {},
		StateNoShow:  {},
	},
	StateServing: {
		StateCompleted: {},
		StateNoShow:    {},
	},
}

func ValidateTransition(from, to State) error {
	if from == to {
		return nil
	}

	next, ok := validTransitions[from]
	if !ok {
		return fmt.Errorf("invalid source state: %s", from)
	}

	if _, ok := next[to]; !ok {
		return fmt.Errorf("invalid ticket transition %s -> %s", from, to)
	}

	return nil
}

func RoutingKeyForState(state State) string {
	return fmt.Sprintf("queue.ticket.%s", state)
}
