package studio.webgame.ghostdesk;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/ghostdesk/saves")
public class SaveController {
    private static final int MAX=1048576;
    private final AccountIdentity identity;
    private final SaveService service;
    private final CatalogMapper catalog;
    private final ObjectMapper json;
    public SaveController(AccountIdentity identity,SaveService service,CatalogMapper catalog,ObjectMapper json) {
        this.identity=identity;this.service=service;this.catalog=catalog;this.json=json;
    }
    private String owner(HttpServletRequest req) {
        return identity.require(req.getHeader("Authorization"),req.getHeader("X-GhostDesk-Account"));
    }
    private Map<String,Object> view(SaveMapper.Row row) {
        try { return Map.of("caseId",row.caseId(),"save",json.readTree(row.payload()),
            "revision",row.revision(),"updatedAt",row.updatedAt()); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE); }
    }
    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest req) {
        String user=owner(req);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(user).stream().map(this::view).toList());
    }
    @PutMapping(value="/{caseId}",consumes=MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> put(@PathVariable String caseId,HttpServletRequest req) throws Exception {
        String user=owner(req);
        byte[] bytes=req.getInputStream().readNBytes(MAX+1);
        if(bytes.length>MAX) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        JsonNode body;
        try { body=json.readTree(bytes); }
        catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
        if(body==null || !body.isObject()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var expected=body.path("expectedRevision");var save=body.path("save");var c=save.path("case");
        var state=save.path("state");String version=c.path("versionId").asText();
        if(!expected.isIntegralNumber()||!expected.canConvertToLong()||expected.asLong()<0||expected.asLong()>9007199254740991L
           ||!save.isObject()||!"ghostdesk-save-1".equals(save.path("format").asText())
           ||!caseId.equals(c.path("caseId").asText())||caseId.length()>80||version.length()>80
           ||!save.path("notes").isTextual()||save.path("notes").asText().length()>10000
           ||!save.has("checkpoint")||!state.isObject()||!version.equals(state.path("caseVersionId").asText())
           ||state.path("schemaVersion").asInt()!=1||!"ghostdesk-core-1".equals(state.path("engineVersion").asText()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        String published=catalog.packageJson(version);
        if(published==null || !json.readTree(published).equals(c))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "published_case_required");
        // The full bounded save is private user data, not an authoritative game score.
        var result=service.put(user,caseId,version,json.writeValueAsString(save),expected.asLong());
        if(result.conflict()) {
            Map<String,Object> response=new HashMap<>();response.put("error","save_conflict");
            response.put("current",result.row()==null?null:view(result.row()));
            return ResponseEntity.status(409).cacheControl(CacheControl.noStore()).body(response);
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(view(result.row()));
    }
}
