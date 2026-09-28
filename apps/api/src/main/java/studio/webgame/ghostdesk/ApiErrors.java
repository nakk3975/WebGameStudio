package studio.webgame.ghostdesk;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> databaseUnavailable() {
        return ResponseEntity.status(503).header("Retry-After", "30")
            .header("Cache-Control", "no-store").body(Map.of("error", "temporarily_unavailable"));
    }
}
