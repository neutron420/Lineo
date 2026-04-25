package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

func main() {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}
	pub := elliptic.Marshal(key.Curve, key.PublicKey.X, key.PublicKey.Y)
	fmt.Println("VAPID_PUBLIC_KEY=" + base64.RawURLEncoding.EncodeToString(pub))
	fmt.Println("VAPID_PRIVATE_KEY=" + base64.RawURLEncoding.EncodeToString(key.D.Bytes()))
	fmt.Println("VAPID_CONTACT=mailto:hello@lineo.ai")
}
