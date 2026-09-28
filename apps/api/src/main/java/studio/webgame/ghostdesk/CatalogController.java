package studio.webgame.ghostdesk;

import java.util.List;
import java.util.Map;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class CatalogController {
    private final CatalogMapper mapper;
    public CatalogController(CatalogMapper mapper) { this.mapper = mapper; }

    @GetMapping("/health/live")
    Map<String, String> live() { return Map.of("status", "ok", "service", "ghostdesk-api"); }

    @GetMapping("/health/ready")
    ResponseEntity<Map<String, Object>> ready() {
        int count = mapper.publishedCount();
        return ResponseEntity.status(count > 0 ? 200 : 503).cacheControl(CacheControl.noStore())
            .body(Map.of("status", count > 0 ? "ready" : "empty", "publishedCases", count));
    }

    @GetMapping("/api/v1/ghostdesk/catalog")
    ResponseEntity<List<CatalogMapper.Entry>> catalog() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(1)))
            .body(mapper.catalog());
    }

    @GetMapping(value="/api/v1/ghostdesk/versions/{versionId}/package", produces=MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<String> casePackage(@PathVariable String versionId) {
        if (!versionId.matches("[a-zA-Z0-9_-]{1,80}")) return ResponseEntity.notFound().build();
        String body = mapper.packageJson(versionId);
        if (body == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)))
            .body(body);
    }
}
