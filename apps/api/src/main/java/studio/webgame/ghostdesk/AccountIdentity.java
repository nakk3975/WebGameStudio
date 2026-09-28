package studio.webgame.ghostdesk;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.crypto.Ed25519Verifier;
import com.nimbusds.jose.proc.*;
import com.nimbusds.jose.util.DefaultResourceRetriever;
import com.nimbusds.jwt.*;
import com.nimbusds.jwt.proc.*;
import java.net.URI;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Only a verified Neon subject establishes ownership; caller IDs never do. */
@Component
public class AccountIdentity {
    private final JWKSource<SecurityContext> keys;
    private final DefaultJWTClaimsVerifier<SecurityContext> verifier;
    @org.springframework.beans.factory.annotation.Autowired
    public AccountIdentity(@Value("${app.auth-url:}") String authUrl) throws Exception {
        if (authUrl.isBlank()) { keys = null; verifier = null; return; }
        URI url = URI.create(authUrl);
        if (!url.getScheme().equals("https")) throw new IllegalArgumentException("Auth requires HTTPS");
        String origin = url.getScheme() + "://" + url.getAuthority();
        keys = new RemoteJWKSet<SecurityContext>(URI.create(authUrl + "/.well-known/jwks.json").toURL(),
            new DefaultResourceRetriever(5000, 5000, 65536));
        verifier = claimsVerifier(origin);
    }
    AccountIdentity(JWKSource<SecurityContext> keys, String origin) { this.keys=keys; this.verifier=claimsVerifier(origin); }
    private static DefaultJWTClaimsVerifier<SecurityContext> claimsVerifier(String origin) {
        var v = new DefaultJWTClaimsVerifier<SecurityContext>(Set.of(origin),
            new JWTClaimsSet.Builder().issuer(origin).build(), Set.of("sub", "exp", "iat"), null);
        v.setMaxClockSkew(30); return v;
    }
    public String require(String authorization, String expectedUser) {
        if (keys == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "auth_unavailable");
        try {
            if (authorization == null || !authorization.startsWith("Bearer ") || authorization.length() > 16384)
                throw new IllegalArgumentException();
            var jwt = SignedJWT.parse(authorization.substring(7));
            if (!JWSAlgorithm.EdDSA.equals(jwt.getHeader().getAlgorithm()) || jwt.getHeader().getKeyID()==null)
                throw new IllegalArgumentException();
            var selector = new JWKSelector(new JWKMatcher.Builder().keyType(KeyType.OKP)
                .curve(Curve.Ed25519).keyID(jwt.getHeader().getKeyID()).build());
            boolean verified=false;
            for (JWK key : keys.get(selector,null))
                if (key instanceof OctetKeyPair pair && jwt.verify(new Ed25519Verifier(pair))) { verified=true; break; }
            if (!verified) throw new IllegalArgumentException();
            var claims = jwt.getJWTClaimsSet(); verifier.verify(claims,null);
            String user = claims.getSubject();
            UUID.fromString(user);
            if (Boolean.TRUE.equals(claims.getBooleanClaim("banned")) || !user.equals(expectedUser))
                throw new IllegalArgumentException();
            return user;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "sign_in_required");
        }
    }
}
