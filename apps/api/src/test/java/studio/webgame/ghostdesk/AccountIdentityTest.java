package studio.webgame.ghostdesk;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.Ed25519Signer;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.OctetKeyPairGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jwt.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class AccountIdentityTest {
 final String origin="https://auth.example", user=UUID.randomUUID().toString();
 final OctetKeyPair key=new OctetKeyPairGenerator(Curve.Ed25519).keyID("test-key").generate();
 final AccountIdentity identity=new AccountIdentity(new ImmutableJWKSet<>(new JWKSet(key.toPublicJWK())),origin);
 AccountIdentityTest() throws Exception {}
 String token(OctetKeyPair signing,String issuer,String aud,long expires,boolean banned) throws Exception {
  var jwt=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.EdDSA).keyID(key.getKeyID()).build(),new JWTClaimsSet.Builder().subject(user).issuer(issuer).audience(aud).issueTime(new Date()).expirationTime(new Date(System.currentTimeMillis()+expires)).claim("banned",banned).build());jwt.sign(new Ed25519Signer(signing));return "Bearer "+jwt.serialize();
 }
 @Test void acceptsRealEd25519Signature() throws Exception {assertEquals(user,identity.require(token(key,origin,origin,60000,false),user));}
 @Test void rejectsWrongSignature() throws Exception {var other=new OctetKeyPairGenerator(Curve.Ed25519).generate();String t=token(other,origin,origin,60000,false);assertThrows(ResponseStatusException.class,()->identity.require(t,user));}
 @Test void rejectsExpiredIssuerAudienceAndBanned() throws Exception {
  for(String t:List.of(token(key,origin,origin,-120000,false),token(key,"https://wrong.example",origin,60000,false),token(key,origin,"https://wrong.example",60000,false),token(key,origin,origin,60000,true)))assertThrows(ResponseStatusException.class,()->identity.require(t,user));
 }
 @Test void refusesAccountSwitchAndAnonymousRequests() throws Exception {String t=token(key,origin,origin,60000,false);assertThrows(ResponseStatusException.class,()->identity.require(t,UUID.randomUUID().toString()));assertThrows(ResponseStatusException.class,()->identity.require(null,user));assertThrows(ResponseStatusException.class,()->identity.require("Bearer not-a-token",user));}
}
